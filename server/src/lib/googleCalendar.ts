import { pool } from '../db.js';

/**
 * Google Calendar sync — pushes confirmed reservations to the connecting
 * user's primary calendar and removes them on cancellation.
 *
 * Auth: OAuth2 authorization-code flow with a stored refresh token
 * (service_credentials, per user). Env: GOOGLE_CLIENT_ID /
 * GOOGLE_CLIENT_SECRET + PUBLIC_BASE_URL (for the redirect URI).
 *
 * All calls are best-effort: a calendar failure never fails the reservation.
 */

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const BASE_URL = process.env.PUBLIC_BASE_URL ?? 'http://localhost:4000';
const SCOPES = 'https://www.googleapis.com/calendar/calendar.events';
const API = 'https://www.googleapis.com/calendar/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export const googleCalendarConfigured = () => CLIENT_ID.length > 0 && CLIENT_SECRET.length > 0;

const redirectUri = () => `${BASE_URL}/api/v1/integrations/google-calendar/callback`;

/** Consent URL for the Admin "Connect" button. */
export function getAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface Credential {
  user_id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: Date | string | null;
}

async function getCredential(userId: string): Promise<Credential | null> {
  const { rows } = await pool.query(
    `SELECT user_id, access_token, refresh_token, expires_at
       FROM service_credentials WHERE user_id = $1 AND service = 'google_calendar'`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function exchangeCode(code: string): Promise<Record<string, unknown>> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri(),
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as Record<string, unknown>;
}

async function refreshAccessToken(cred: Credential): Promise<Credential> {
  if (!cred.refresh_token) throw new Error('No refresh token for Google Calendar');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: cred.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);
  await pool.query(
    `UPDATE service_credentials
        SET access_token = $1, expires_at = $2, updated_at = now()
      WHERE user_id = $3 AND service = 'google_calendar'`,
    [data.access_token, expiresAt, cred.user_id],
  );
  return { ...cred, access_token: data.access_token, expires_at: expiresAt };
}

/** Authenticated Google Calendar API call with one token-refresh retry. */
async function gFetch(
  userId: string,
  path: string,
  init: RequestInit = {},
): Promise<Record<string, unknown>> {
  let cred = await getCredential(userId);
  if (!cred?.refresh_token && !cred?.access_token) throw new Error('Google Calendar not connected');

  const doFetch = async (token: string) =>
    fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

  let res = await doFetch(cred.access_token ?? '');
  if (res.status === 401 && cred.refresh_token) {
    cred = await refreshAccessToken(cred);
    res = await doFetch(cred.access_token!);
  }
  if (!res.ok) {
    throw new Error(`Google Calendar API error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

const isExpired = (cred: Credential | null) => {
  if (!cred?.expires_at) return true;
  return new Date(cred.expires_at).getTime() - Date.now() < 60_000;
};

/** Ensure a usable access token is on file (refresh when close to expiry). */
export async function ensureFreshToken(userId: string): Promise<boolean> {
  const cred = await getCredential(userId);
  if (!cred?.access_token || isExpired(cred)) {
    if (!cred?.refresh_token) return false;
    await refreshAccessToken(cred);
  }
  return true;
}

/** Create the calendar event for a confirmed reservation. Floating local time. */
export async function createReservationEvent(opts: {
  userId: string;
  reservationId: string;
  guestName: string;
  partySize: number;
  date: string; // YYYY-MM-DD
  timeSlot: string; // HH:MM
  tableName?: string | null;
  restaurantName: string;
}): Promise<string> {
  const start = `${opts.date}T${opts.timeSlot.slice(0, 5)}:00`;
  const [h, m] = opts.timeSlot.slice(0, 5).split(':').map(Number);
  const endMinutes = h * 60 + m + 120; // standard 2h table slot
  const end = `${opts.date}T${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}:00`;

  const body = JSON.stringify({
    summary: `${opts.guestName} (party of ${opts.partySize})${opts.tableName ? ` — ${opts.tableName}` : ''} · ${opts.restaurantName}`,
    description: `Reservation ${opts.reservationId}`,
    start: { dateTime: start, timeZone: 'UTC' },
    end: { dateTime: end, timeZone: 'UTC' },
  });
  const data = await gFetch(opts.userId, '/calendars/primary/events', {
    method: 'POST',
    body,
  });
  const eventId = String(data.id ?? '');
  if (eventId) {
    await pool.query('UPDATE reservations SET google_event_id = $1 WHERE id = $2', [eventId, opts.reservationId]);
  }
  return eventId;
}

/** Delete the linked calendar event (cancellation / no-show). */
export async function deleteReservationEvent(userId: string, eventId: string): Promise<boolean> {
  try {
    await gFetch(userId, `/calendars/primary/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' });
    await pool.query(
      `UPDATE reservations SET google_event_id = NULL WHERE google_event_id = $1`,
      [eventId],
    );
    return true;
  } catch (err) {
    console.warn('[google-calendar] event delete failed:', err);
    return false;
  }
}

/**
 * Pull conflicts: busy ranges on the user's primary calendar for a local date.
 * Used to warn (not block) when a requested slot overlaps existing calendar
 * commitments.
 */
export async function getBusyRanges(
  userId: string,
  dateISO: string,
): Promise<{ start: string; end: string }[] | null> {
  try {
    const data = await gFetch(userId, '/freeBusy', {
      method: 'POST',
      body: JSON.stringify({
        timeMin: `${dateISO}T00:00:00Z`,
        timeMax: `${dateISO}T23:59:59Z`,
        items: [{ id: 'primary' }],
      }),
    });
    const cal = ((data.calendars ?? {}) as Record<string, unknown>)['primary'] as
      | { busy?: { start: string; end: string }[] }
      | undefined;
    return (cal?.busy ?? []).map((b) => ({
      start: String(b.start ?? '').slice(11, 16),
      end: String(b.end ?? '').slice(11, 16),
    }));
  } catch (err) {
    console.warn('[google-calendar] freeBusy failed:', err);
    return null;
  }
}

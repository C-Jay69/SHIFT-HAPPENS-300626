import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { requireAuth, currentUser } from '../middleware/auth.js';
import { stripeConfigured } from '../lib/payment.js';
import {
  googleCalendarConfigured,
  getAuthUrl,
  exchangeCode,
} from '../lib/googleCalendar.js';
import { buildReviewReport, yelpConfigured } from '../lib/yelp.js';
import { ApiError } from '../middleware/error.js';

const router = Router();
router.use(requireAuth);

interface IntegrationStatus {
  key: string;
  label: string;
  configured: boolean;
  note?: string;
}

router.get('/', async (_req, res, _next) => {
  const status: IntegrationStatus[] = [
    {
      key: 'stripe',
      label: 'Stripe (Payments)',
      configured: stripeConfigured(),
      note: process.env.STRIPE_WEBHOOK_SECRET ? 'Webhook enabled' : 'Webhook secret not set',
    },
    {
      key: 'twilio_voice',
      label: 'Twilio Voice (AI Phone Agent)',
      configured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      note: 'Point your Twilio number at POST /api/v1/voice',
    },
    {
      key: 'twilio_sms',
      label: 'Twilio SMS (Notifs)',
      configured: Boolean(
        process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER,
      ),
      note: 'Sends reservation confirmations + waitlist alerts',
    },
    {
      key: 'sendgrid',
      label: 'SendGrid (Email)',
      configured: Boolean(process.env.SENDGRID_API_KEY),
      note: 'Sends reservation + waitlist email confirmations',
    },
    {
      key: 'google_calendar',
      label: 'Google Calendar Sync',
      configured: googleCalendarConfigured(),
      note: googleCalendarConfigured()
        ? 'Connect per user from the Admin console (reservations sync to your calendar)'
        : 'Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + PUBLIC_BASE_URL',
    },
    {
      key: 'docusign',
      label: 'DocuSign (Contracts)',
      configured: Boolean(process.env.DOCUSIGN_ACCESS_TOKEN),
    },
    {
      key: 'llm',
      label: 'LLM (ShiftBot / Voice AI / RAG)',
      configured: Boolean(process.env.OPENROUTER_API_KEY),
      note: process.env.OPENROUTER_API_KEY
        ? `Model: ${process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini'}`
        : 'Set OPENROUTER_API_KEY (any OpenAI-compatible endpoint)',
    },
    {
      key: 'maps',
      label: 'Google Places (Reviews)',
      configured: Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY),
    },
    {
      key: 'yelp',
      label: 'Yelp Fusion (Reviews & Sentiment)',
      configured: yelpConfigured(),
      note: yelpConfigured() ? 'GET /integrations/yelp/reviews for the sentiment report' : undefined,
    },
  ];
  res.json(status);
});

// --- Google Calendar (per-user OAuth2) ---------------------------------------

const JWT_SECRET =
  process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET || 'dev-secret-change-me';
const CAL_SCOPES = 'https://www.googleapis.com/calendar/calendar.events';

router.get('/google-calendar', requireAuth, async (req, res, next) => {
  try {
    const user = currentUser(req);
    const { rows } = await pool.query(
      `SELECT 1 FROM service_credentials WHERE user_id = $1 AND service = 'google_calendar'`,
      [user.id],
    );
    res.json({ configured: googleCalendarConfigured(), connected: rows.length > 0 });
  } catch (e) {
    next(e);
  }
});

router.get('/google-calendar/authorize', requireAuth, (req, res, next) => {
  try {
    if (!googleCalendarConfigured()) {
      throw new ApiError(503, 'Google Calendar is not configured (set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)');
    }
    const user = currentUser(req);
    // Short-lived signed state so the callback knows which user connected.
    const state = jwt.sign({ sub: user.id, s: 'gcal-auth' }, JWT_SECRET, { expiresIn: '10m' });
    res.json({ url: `${getAuthUrl()}&state=${encodeURIComponent(state)}` });
  } catch (e) {
    next(e);
  }
});

// OAuth callback — unauthenticated (browser redirect), user identity comes
// from the signed `state` round-tripped through Google.
router.get('/google-calendar/callback', async (req, res, next) => {
  try {
    const { code, state, error } = req.query as Record<string, string | undefined>;
    if (error) throw new ApiError(400, `Google auth error: ${error}`);
    if (!code || !state) throw new ApiError(400, 'Missing code or state');

    let userId: string;
    try {
      const payload = jwt.verify(state, JWT_SECRET) as { sub?: string; s?: string };
      if (payload.s !== 'gcal-auth' || !payload.sub) throw new Error('bad state');
      userId = payload.sub;
    } catch {
      throw new ApiError(400, 'Invalid or expired authorization state — try again');
    }

    const tokens = await exchangeCode(code);
    const access = String(tokens.access_token ?? '');
    const refresh = String(tokens.refresh_token ?? '');
    const expiresIn = Number(tokens.expires_in ?? 3600);
    if (!access || !refresh) throw new ApiError(502, 'Google did not return a refresh token');

    await pool.query(
      `INSERT INTO service_credentials (user_id, service, scope, access_token, refresh_token, expires_at)
       VALUES ($1, 'google_calendar', $2, $3, $4, $5)
       ON CONFLICT (user_id, service)
       DO UPDATE SET scope = EXCLUDED.scope,
                     access_token = EXCLUDED.access_token,
                     refresh_token = EXCLUDED.refresh_token,
                     expires_at = EXCLUDED.expires_at,
                     updated_at = now()`,
      [userId, CAL_SCOPES, access, refresh, new Date(Date.now() + expiresIn * 1000)],
    );

    const base = process.env.PUBLIC_BASE_URL ?? 'http://localhost:4000';
    res.redirect(`${base}/#/admin?tab=INTEGRATIONS&gcal=connected`);
  } catch (e) {
    next(e);
  }
});

router.post('/google-calendar/disconnect', requireAuth, async (req, res, next) => {
  try {
    const user = currentUser(req);
    await pool.query(
      `DELETE FROM service_credentials WHERE user_id = $1 AND service = 'google_calendar'`,
      [user.id],
    );
    res.json({ disconnected: true });
  } catch (e) {
    next(e);
  }
});

// --- Yelp Reviews & Sentiment -------------------------------------------------

router.get('/yelp/reviews', requireAuth, async (req, res, next) => {
  try {
    if (!yelpConfigured()) {
      throw new ApiError(503, 'Yelp is not configured. Set YELP_API_KEY to pull reviews.');
    }
    // Default to the first restaurant's name + address (single-tenant demo).
    const { rows } = await pool.query('SELECT name, address FROM restaurants ORDER BY created_at ASC LIMIT 1');
    const name = String(req.query.name ?? rows[0]?.name ?? 'restaurant');
    const location = req.query.location
      ? String(req.query.location)
      : rows[0]?.address ?? undefined;
    const limit = Math.min(50, Math.max(5, Number(req.query.limit ?? 30)));
    const report = await buildReviewReport(name, location, limit);
    res.json(report);
  } catch (e) {
    next(e);
  }
});

export const integrationsRouter = router;
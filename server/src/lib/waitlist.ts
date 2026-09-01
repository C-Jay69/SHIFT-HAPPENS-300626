import { pool } from '../db.js';
import { smartReservation } from './reservation.js';
import { notifyWaitlistSeated } from './notify.js';

/**
 * Waitlist cron — step 3c of the Smart Reservation Flow.
 *
 * Every tick, waiting entries whose requested date has arrived are retried
 * against live table availability. When a slot opens, the guest is booked
 * (source 'phone'), the waitlist row is marked notified, and the guest is
 * pinged by SMS/email (key-gated). Entries that are still full are left
 * untouched and retried on the next tick.
 *
 * Runs in-process on a setInterval (single-instance deployment, matching the
 * PM2/Dockerfile topology). Set WAITLIST_CRON_MS to tune the interval, or
 * WAITLIST_CRON_MS=0 to disable.
 */

const DEFAULT_INTERVAL_MS = 60_000;
let timer: NodeJS.Timeout | null = null;
let running = false;

async function resolveRestaurantId(): Promise<string | null> {
  const { rows } = await pool.query('SELECT id FROM restaurants ORDER BY created_at ASC LIMIT 1');
  return rows[0]?.id ?? null;
}

export async function processWaitlist(): Promise<number> {
  if (running) return 0; // never overlap ticks
  running = true;
  let seated = 0;

  try {
    const { rows } = await pool.query(
      `SELECT w.*, g.first_name, g.last_name, g.phone, g.email
         FROM waitlist w
         LEFT JOIN guests g ON g.id = w.guest_id
        WHERE w.status = 'waiting'
          AND w.requested_date <= CURRENT_DATE
        ORDER BY w.created_at ASC
        LIMIT 25`,
    );

    for (const entry of rows) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await smartReservation(client, {
          guestId: entry.guest_id ?? undefined,
          partySize: Number(entry.party_size),
          date: entry.requested_date,
          timeSlot: String(entry.requested_time).slice(0, 5),
          source: 'phone',
          tableId: null,
          createdBy: null,
          restaurantId: await resolveRestaurantId(),
          skipWaitlist: true, // we ARE the waitlist entry — don't double-add
        });
        await client.query('COMMIT');

        if (result.reservation) {
          const reservation = result.reservation as { id: string };
          await pool.query(
            `UPDATE waitlist
                SET status = 'notified',
                    notified_at = now()
              WHERE id = $1`,
            [entry.id],
          );
          // Link the booking to the call flow convention: record which
          // waitlist entry produced the reservation for traceability.
          await pool.query(
            `UPDATE reservations SET notes = COALESCE(notes || E'\\n', '') || $1
              WHERE id = $2`,
            [`Waitlist entry ${String(entry.id).slice(0, 8)}… auto-seated`, reservation.id],
          );
          seated += 1;
          await notifyWaitlistSeated(
            {
              firstName: entry.first_name ?? 'Guest',
              lastName: entry.last_name ?? '',
              phone: entry.phone,
              email: entry.email,
            },
            {
              date: entry.requested_date,
              timeSlot: String(entry.requested_time).slice(0, 5),
              partySize: Number(entry.party_size),
            },
          );
          console.log(`[waitlist] Entry ${entry.id} auto-seated (party of ${entry.party_size}).`);
        }
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        console.error('[waitlist] Failed to rebook entry', entry.id, err);
      } finally {
        client.release();
      }
    }
  } catch (err) {
    console.error('[waitlist] Cron tick failed:', err);
  } finally {
    running = false;
  }

  return seated;
}

export function startWaitlistCron(): void {
  const intervalMs = Number(process.env.WAITLIST_CRON_MS ?? DEFAULT_INTERVAL_MS);
  if (!intervalMs || intervalMs <= 0) {
    console.log('[waitlist] Cron disabled (WAITLIST_CRON_MS=0).');
    return;
  }
  timer = setInterval(() => {
    void processWaitlist();
  }, intervalMs);
  timer.unref?.(); // never keep the process alive just for the cron
  console.log(`[waitlist] Cron started — checking waiting guests every ${Math.round(intervalMs / 1000)}s.`);
}

export function stopWaitlistCron(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

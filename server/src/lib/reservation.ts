import type { PoolClient } from 'pg';

export const RESERVATION_SLOT_WINDOW_SECONDS = 7200; // 2h: a table counts as busy around its slot
const RESERVED_STATUSES = ['pending', 'confirmed', 'seated'];

export interface BookingRequest {
  guestId?: string | null;
  firstName?: string;
  lastName?: string;
  phone?: string;
  partySize: number;
  date: string; // YYYY-MM-DD
  timeSlot: string; // HH:MM
  source: 'phone' | 'web' | 'ai_agent' | 'walk_in' | 'third_party';
  tableId?: string | null;
  notes?: string;
  createdBy: string | null;
  restaurantId: string | null;
}

export type BookingResult =
  | {
      reservation: unknown;
      waitlistPosition: null;
      estimatedWaitMinutes: null;
    }
  | {
      reservation: null;
      waitlistPosition: number;
      estimatedWaitMinutes: number;
    };

/**
 * Smart Reservation Flow:
 *  1. Resolve or create the guest
 *  2. Find an available table (capacity >= party, currently available, no
 *     live reservation within the slot window)
 *  3a. Available  -> confirmed reservation, table marked reserved
 *  3b. Unavailable -> added to waitlist with position + estimated wait
 * Runs entirely on the supplied client so callers control the transaction.
 */
export async function smartReservation(
  client: PoolClient,
  body: BookingRequest,
): Promise<BookingResult> {
  // 1. Resolve/create the guest
  let guestId = body.guestId ?? null;
  if (!guestId && body.phone) {
    const found = await client.query(
      'SELECT id FROM guests WHERE phone = $1 AND deleted_at IS NULL LIMIT 1',
      [body.phone],
    );
    if (found.rowCount) guestId = found.rows[0].id as string;
  }
  if (!guestId) {
    const ins = await client.query(
      `INSERT INTO guests (first_name, last_name, phone)
       VALUES ($1, $2, NULLIF($3, '')) RETURNING id`,
      [body.firstName ?? 'Walk-in', body.lastName ?? '', body.phone ?? ''],
    );
    guestId = ins.rows[0].id as string;
  }

  // 2. Availability check
  const { rows: candidateTables } = await client.query(
    `SELECT t.*
       FROM tables t
      WHERE t.restaurant_id = $1
        AND t.capacity >= $2
        AND t.status = 'available'
        AND NOT EXISTS (
          SELECT 1 FROM reservations r
           WHERE r.table_id = t.id
             AND r.date = $3
             AND ABS(EXTRACT(EPOCH FROM (r.time_slot - $4::time))) < $5
             AND r.status = ANY($6)
        )
      ORDER BY t.capacity ASC, t.id ASC
      LIMIT 1`,
    [body.restaurantId, body.partySize, body.date, body.timeSlot, RESERVATION_SLOT_WINDOW_SECONDS, RESERVED_STATUSES],
  );

  const table = candidateTables[0] ?? null;
  const requestedAvailable = body.tableId !== undefined && body.tableId !== null && table?.id === body.tableId;
  const tableId =
    table && (body.tableId === undefined || body.tableId === null || requestedAvailable)
      ? (table.id as string)
      : null;

  if (tableId) {
    const { rows } = await client.query(
      `INSERT INTO reservations
         (guest_id, table_id, party_size, date, time_slot, status, source, created_by, notes)
       VALUES ($1, $2, $3, $4, $5, 'confirmed', $6, $7, NULLIF($8, ''))
       RETURNING *`,
      [guestId, tableId, body.partySize, body.date, body.timeSlot, body.source, body.createdBy, body.notes ?? ''],
    );
    await client.query("UPDATE tables SET status = 'reserved' WHERE id = $1", [tableId]);
    return {
      reservation: rows[0],
      waitlistPosition: null,
      estimatedWaitMinutes: null,
    };
  }

  // 3b. Add to waitlist
  const pos = await client.query(
    `INSERT INTO waitlist (guest_id, party_size, requested_date, requested_time)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [guestId, body.partySize, body.date, body.timeSlot],
  );
  const position = await client.query(
    `SELECT COUNT(*)::int AS position FROM waitlist
      WHERE requested_date = $1 AND status = 'waiting'
        AND created_at <= (SELECT created_at FROM waitlist WHERE id = $2)`,
    [body.date, pos.rows[0].id],
  );

  return {
    reservation: null,
    waitlistPosition: position.rows[0].position,
    estimatedWaitMinutes: 30 + Math.max(0, position.rows[0].position - 1) * 10,
  };
}

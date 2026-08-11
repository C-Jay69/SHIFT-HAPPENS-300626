import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, currentUser } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { smartReservation } from '../lib/reservation.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  guestId: z.string().uuid().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  partySize: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  timeSlot: z.string().regex(/^\d{2}:\d{2}$/, 'timeSlot must be HH:MM'),
  source: z.enum(['phone', 'web', 'ai_agent', 'walk_in', 'third_party']).default('web'),
  tableId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const patchSchema = z.object({
  partySize: z.number().int().positive().optional(),
  timeSlot: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  status: z.enum(['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show']).optional(),
  tableId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, g.first_name, g.last_name, g.phone AS guest_phone, t.name AS table_name
         FROM reservations r
         LEFT JOIN guests g ON g.id = r.guest_id
         LEFT JOIN tables t ON t.id = r.table_id
        WHERE r.date >= CURRENT_DATE
        ORDER BY r.date ASC, r.time_slot ASC
        LIMIT 200`,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get('/waitlist', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT w.*, g.first_name, g.last_name, g.phone AS guest_phone
         FROM waitlist w
         LEFT JOIN guests g ON g.id = w.guest_id
        WHERE w.status = 'waiting'
        ORDER BY w.created_at ASC`,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const body = createSchema.parse(req.body);
    const user = currentUser(req);

    const result = await smartReservation(client, {
      ...body,
      createdBy: user.id,
      restaurantId: user.restaurantId,
    });

    await client.query('COMMIT');
    if (result.reservation) {
      return res.status(201).json(result);
    }
    return res.status(202).json(result);
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const body = patchSchema.parse(req.body);
    const { rows } = await pool.query(
      `UPDATE reservations SET
         party_size = COALESCE($2, party_size),
         time_slot  = COALESCE($3, time_slot),
         status     = COALESCE($4, status),
         table_id   = COALESCE($5, table_id),
         notes      = COALESCE($6, notes),
         updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, body.partySize ?? null, body.timeSlot ?? null, body.status ?? null, body.tableId ?? null, body.notes ?? null],
    );
    if (!rows[0]) throw new ApiError(404, 'Reservation not found');

    const r = rows[0];
    if (r.status === 'cancelled' || r.status === 'completed' || r.status === 'no_show') {
      await pool.query(
        `UPDATE tables SET status = 'available'
          WHERE id = $1 AND status = 'reserved'`,
        [r.table_id],
      );
    }
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

export const reservationsRouter = router;

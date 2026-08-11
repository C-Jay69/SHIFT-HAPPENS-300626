import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

const router = Router();
router.use(requireAuth);

const guestSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().default(''),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  vipStatus: z.boolean().optional(),
  notes: z.string().optional().or(z.literal('')),
});

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, email, phone, vip_status, total_spend, loyalty_points, notes, created_at
         FROM guests
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 100`,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, email, phone, vip_status, total_spend, loyalty_points, notes, created_at
         FROM guests WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id],
    );
    if (!rows[0]) throw new ApiError(404, 'Guest not found');
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = guestSchema.parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO guests (first_name, last_name, email, phone, vip_status, notes)
       VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), $5, NULLIF($6, ''))
       RETURNING *`,
      [body.firstName, body.lastName, body.email ?? '', body.phone ?? '', body.vipStatus ?? false, body.notes ?? ''],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const body = guestSchema.partial().parse(req.body);
    const updates = Object.keys(body);
    if (updates.length === 0) throw new ApiError(400, 'No fields to update');

    const columnMap: Record<string, string> = {
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'email',
      phone: 'phone',
      vipStatus: 'vip_status',
      notes: 'notes',
    };

    const sets = updates
      .map((key, i) => `${columnMap[key]} = $${i + 2}`)
      .join(', ');
    const values = updates.map((key) => body[key as keyof typeof body]);

    const { rows } = await pool.query(
      `UPDATE guests SET ${sets}, updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *`,
      [req.params.id, ...values],
    );
    if (!rows[0]) throw new ApiError(404, 'Guest not found');
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

export const guestsRouter = router;

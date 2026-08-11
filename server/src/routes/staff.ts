import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, currentUser, requirePermission } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

const router = Router();
router.use(requireAuth);

// --- Staff ---

const staffSchema = z.object({
  userId: z.string().uuid().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['manager', 'server', 'cook', 'host']),
  hourlyRate: z.number().nonnegative().optional(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['active', 'on_leave', 'terminated']).optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const { rows } = await pool.query(
      `SELECT s.*, u.email
         FROM staff s
         LEFT JOIN users u ON u.id = s.user_id
        WHERE s.restaurant_id = $1
        ORDER BY s.first_name ASC`,
      [user.restaurantId],
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/', requirePermission('staff.manage'), async (req, res, next) => {
  try {
    const user = currentUser(req);
    const body = staffSchema.parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO staff (user_id, restaurant_id, first_name, last_name, role, hourly_rate, hire_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [body.userId ?? null, user.restaurantId, body.firstName, body.lastName, body.role, body.hourlyRate ?? 0, body.hireDate ?? null, body.status ?? 'active'],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// --- Shifts ---

const shiftSchema = z.object({
  staffId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  role: z.string().optional(),
});

router.get('/shifts', async (req, res, next) => {
  try {
    const start = String(req.query.start ?? '');
    const end = String(req.query.end ?? '');
    const params: unknown[] = [];
    let where = 'WHERE 1=1';
    if (start) { params.push(start); where += ` AND date >= $${params.length}`; }
    if (end) { params.push(end); where += ` AND date <= $${params.length}`; }
    const { rows } = await pool.query(
      `SELECT s.*, st.first_name, st.last_name, st.role AS staff_role
         FROM shifts s
         JOIN staff st ON st.id = s.staff_id
        ${where}
        ORDER BY s.date ASC, s.start_time ASC`,
      params,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/shifts', requirePermission('staff.manage'), async (req, res, next) => {
  try {
    const body = shiftSchema.parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO shifts (staff_id, date, start_time, end_time, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [body.staffId, body.date, body.startTime, body.endTime, body.role ?? null],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.delete('/shifts/:id', requirePermission('staff.manage'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM shifts WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// --- Time clock ---

const clockInSchema = z.object({
  staffId: z.string().uuid(),
  tipsDeclared: z.number().nonnegative().optional(),
});

router.post('/clock-in', async (req, res, next) => {
  try {
    const body = clockInSchema.parse(req.body);
    const open = await pool.query(
      'SELECT id FROM time_logs WHERE staff_id = $1 AND clock_out IS NULL LIMIT 1',
      [body.staffId],
    );
    if (open.rowCount) throw new ApiError(409, 'Staff member is already clocked in');

    const { rows } = await pool.query(
      'INSERT INTO time_logs (staff_id, clock_in, tips_declared) VALUES ($1, now(), $2) RETURNING *',
      [body.staffId, body.tipsDeclared ?? 0],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.post('/clock-out', async (req, res, next) => {
  try {
    const body = clockInSchema.parse(req.body);
    const { rows } = await pool.query(
      `UPDATE time_logs
          SET clock_out = now(),
              break_minutes = COALESCE($2, break_minutes),
              tips_declared = COALESCE($3, tips_declared)
        WHERE staff_id = $1 AND clock_out IS NULL
        RETURNING *`,
      [body.staffId, 0, body.tipsDeclared ?? null],
    );
    if (!rows[0]) throw new ApiError(404, 'No open time log for this staff member');
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.get('/time-logs', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, s.first_name, s.last_name
         FROM time_logs t
         JOIN staff s ON s.id = t.staff_id
        ORDER BY t.clock_in DESC
        LIMIT 100`,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

export const staffRouter = router;
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, requirePermission, currentUser } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

const router = Router();
router.use(requireAuth);

const tableSchema = z.object({
  name: z.string().min(1),
  capacity: z.number().int().positive(),
  status: z.enum(['available', 'occupied', 'reserved', 'dirty']).optional(),
  floorPlanX: z.number().int().optional(),
  floorPlanY: z.number().int().optional(),
});

router.get('/', async (_req, res, next) => {
  try {
    const user = currentUser(_req);
    const { rows } = await pool.query(
      `SELECT t.*,
              (SELECT o.id FROM orders o
                WHERE o.table_id = t.id AND o.status NOT IN ('paid', 'void')
                ORDER BY o.created_at DESC LIMIT 1) AS current_order_id
         FROM tables t
        WHERE t.restaurant_id = $1
        ORDER BY t.name ASC`,
      [user.restaurantId],
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/', requirePermission('pos.charge'), async (req, res, next) => {
  try {
    const user = currentUser(req);
    const body = tableSchema.parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO tables (restaurant_id, name, capacity, floor_plan_x, floor_plan_y, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user.restaurantId, body.name, body.capacity, body.floorPlanX ?? 0, body.floorPlanY ?? 0, body.status ?? 'available'],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', requirePermission('pos.charge'), async (req, res, next) => {
  try {
    const body = tableSchema.partial().parse(req.body);
    const sets: string[] = [];
    const values: unknown[] = [req.params.id];

    if (body.name !== undefined) { sets.push(`name = $${values.length + 1}`); values.push(body.name); }
    if (body.capacity !== undefined) { sets.push(`capacity = $${values.length + 1}`); values.push(body.capacity); }
    if (body.status !== undefined) { sets.push(`status = $${values.length + 1}`); values.push(body.status); }
    if (body.floorPlanX !== undefined) { sets.push(`floor_plan_x = $${values.length + 1}`); values.push(body.floorPlanX); }
    if (body.floorPlanY !== undefined) { sets.push(`floor_plan_y = $${values.length + 1}`); values.push(body.floorPlanY); }

    if (sets.length === 0) throw new ApiError(400, 'No fields to update');

    const { rows } = await pool.query(
      `UPDATE tables SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      values,
    );
    if (!rows[0]) throw new ApiError(404, 'Table not found');
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

export const tablesRouter = router;

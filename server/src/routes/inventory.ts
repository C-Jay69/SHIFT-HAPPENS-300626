import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, requirePermission, currentUser } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

const router = Router();
router.use(requireAuth);

// --- Ingredients ---

router.get('/ingredients', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*,
              i.current_stock <= i.reorder_threshold AS is_low,
              COALESCE(
                (SELECT json_agg(json_build_object('id', s.id, 'name', s.name, 'price', isp.price, 'leadTimeDays', isp.lead_time_days))
                   FROM ingredient_suppliers isp
                   JOIN suppliers s ON s.id = isp.supplier_id
                  WHERE isp.ingredient_id = i.id), '[]') AS suppliers
         FROM ingredients i
        WHERE i.deleted_at IS NULL
        ORDER BY i.name ASC`,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

const ingredientSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  currentStock: z.number().nonnegative().optional(),
  reorderThreshold: z.number().nonnegative().optional(),
  unitCost: z.number().nonnegative().optional(),
});

router.post('/ingredients', requirePermission('inventory.manage'), async (req, res, next) => {
  try {
    const user = currentUser(req);
    const body = ingredientSchema.parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO ingredients (restaurant_id, name, unit, current_stock, reorder_threshold, unit_cost)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user.restaurantId, body.name, body.unit, body.currentStock ?? 0, body.reorderThreshold ?? 0, body.unitCost ?? 0],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// --- Stock adjustments (audited stock_transactions) ---

const adjustmentSchema = z.object({
  ingredientId: z.string().uuid(),
  quantityChange: z.number().refine((v) => v !== 0, 'quantityChange must be non-zero'),
  reason: z.enum(['purchase', 'sale_deduction', 'waste', 'adjustment', 'transfer']),
});

router.post('/adjustments', requirePermission('inventory.manage'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const body = adjustmentSchema.parse(req.body);
    const user = currentUser(req);

    const ing = await client.query(
      'SELECT id, current_stock FROM ingredients WHERE id = $1 AND deleted_at IS NULL',
      [body.ingredientId],
    );
    if (!ing.rowCount) throw new ApiError(404, 'Ingredient not found');

    const newStock = Math.max(0, Number(ing.rows[0].current_stock) + body.quantityChange);
    await client.query('UPDATE ingredients SET current_stock = $1, updated_at = now() WHERE id = $2', [newStock, body.ingredientId]);

    const tx = await client.query(
      `INSERT INTO stock_transactions (ingredient_id, quantity_change, reason, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [body.ingredientId, body.quantityChange, body.reason, user.id],
    );

    await client.query('COMMIT');
    res.status(201).json({ transaction: tx.rows[0], newStock });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

// --- Suppliers ---

router.get('/suppliers', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM suppliers ORDER BY name ASC');
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/suppliers', requirePermission('inventory.manage'), async (req, res, next) => {
  try {
    const body = z.object({ name: z.string().min(1), contactEmail: z.string().optional(), contactPhone: z.string().optional() }).parse(req.body);
    const { rows } = await pool.query(
      'INSERT INTO suppliers (name, contact_email, contact_phone) VALUES ($1, $2, $3) RETURNING *',
      [body.name, body.contactEmail ?? null, body.contactPhone ?? null],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// --- Open low-stock alerts ---

router.get('/alerts', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, i.name AS ingredient_name
         FROM inventory_alerts a
         JOIN ingredients i ON i.id = a.ingredient_id
        WHERE a.status = 'open'
        ORDER BY a.created_at DESC`,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

export const inventoryRouter = router;

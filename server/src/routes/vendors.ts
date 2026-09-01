import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, currentUser } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

const router = Router();
router.use(requireAuth);

/**
 * Vendor Marketplace
 * ------------------
 * Suppliers + products, a cheapest-source comparison per ingredient, and
 * purchase orders. Receiving an order auto-stocks matching ingredients
 * (case-insensitive name match) with reason='purchase' — the same audit
 * trail the POS uses for deductions.
 */

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*,
              (SELECT count(*)::int FROM vendor_products p WHERE p.supplier_id = s.id) AS product_count,
              (SELECT count(*)::int FROM ingredient_suppliers i WHERE i.supplier_id = s.id) AS carried_ingredients
         FROM suppliers s ORDER BY s.name`,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().min(2).max(120),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().max(40).optional(),
        category: z.string().max(60).optional(),
      })
      .parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO suppliers (name, contact_email, contact_phone, category)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [body.name, body.contactEmail ?? null, body.contactPhone ?? null, body.category ?? null],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`DELETE FROM suppliers WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows[0]) throw new ApiError(404, 'Supplier not found');
    res.json({ deleted: rows[0].id });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

router.get('/:id/products', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM vendor_products WHERE supplier_id = $1 ORDER BY name`,
      [req.params.id],
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

const productSchema = z.object({
  name: z.string().min(1).max(120),
  unit: z.string().min(1).max(20),
  unitCost: z.number().min(0).max(100000),
  minOrder: z.number().min(0).default(0),
});

router.post('/:id/products', async (req, res, next) => {
  try {
    const body = productSchema.parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO vendor_products (supplier_id, name, unit, unit_cost, min_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, body.name, body.unit, body.unitCost, body.minOrder],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id/products/:productId', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM vendor_products WHERE id = $1 AND supplier_id = $2 RETURNING id`,
      [req.params.productId, req.params.id],
    );
    if (!rows[0]) throw new ApiError(404, 'Product not found');
    res.json({ deleted: rows[0].id });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// Cheapest-source comparison per ingredient
// ---------------------------------------------------------------------------

router.get('/compare', async (req, res, next) => {
  try {
    const user = currentUser(req);
    // Winner = cheapest supplier per ingredient (ties broken by lead time).
    const { rows } = await pool.query(
      `SELECT i.id, i.name, i.unit,
              i.current_stock::float8 AS stock,
              i.reorder_threshold::float8 AS threshold,
              best.name AS best_supplier,
              best.price::float8 AS best_price,
              best.lead_time_days AS best_lead_days,
              (SELECT count(*)::int FROM ingredient_suppliers x WHERE x.ingredient_id = i.id) AS sources
         FROM ingredients i
         JOIN LATERAL (
           SELECT s.name, is2.price, is2.lead_time_days
             FROM ingredient_suppliers is2
             JOIN suppliers s ON s.id = is2.supplier_id
            WHERE is2.ingredient_id = i.id
            ORDER BY is2.price ASC, is2.lead_time_days ASC
            LIMIT 1
         ) best ON true
        WHERE i.restaurant_id = $1 AND i.deleted_at IS NULL
          AND EXISTS (SELECT 1 FROM ingredient_suppliers is3 WHERE is3.ingredient_id = i.id)
        ORDER BY i.name`,
      [user.restaurantId],
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// Purchase orders
// ---------------------------------------------------------------------------

const orderSchema = z.object({
  supplierId: z.string().uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        qty: z.number().positive().max(100000),
      }),
    )
    .min(1),
  notes: z.string().max(500).optional(),
});

router.post('/orders', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const body = orderSchema.parse(req.body);
    const { rows: prodRows } = await pool.query(
      `SELECT id, name, unit, unit_cost::float8 AS unit_cost, min_order::float8 AS min_order
         FROM vendor_products WHERE supplier_id = $1 AND id = ANY($2::uuid[])`,
      [body.supplierId, body.items.map((i) => i.productId)],
    );
    const byId = new Map(prodRows.map((p) => [p.id, p]));
    const items: { product_id: string; name: string; qty: number; unit: string; unit_cost: number }[] = [];
    for (const it of body.items) {
      const p = byId.get(it.productId);
      if (!p) throw new ApiError(400, `Product ${it.productId} does not belong to this supplier`);
      if (p.min_order > 0 && it.qty < p.min_order) {
        throw new ApiError(400, `"${p.name}" has a minimum order of ${p.min_order} ${p.unit}`);
      }
      items.push({ product_id: p.id, name: p.name, qty: it.qty, unit: p.unit, unit_cost: p.unit_cost });
    }
    const total = Math.round(items.reduce((a, i) => a + i.qty * i.unit_cost, 0) * 100) / 100;
    const { rows } = await pool.query(
      `INSERT INTO vendor_orders (supplier_id, status, items, total, notes, ordered_by)
       VALUES ($1, 'sent', $2, $3, $4, $5) RETURNING *`,
      [body.supplierId, JSON.stringify(items), total, body.notes ?? null, user.id],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.get('/orders', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*, s.name AS supplier_name FROM vendor_orders o
         JOIN suppliers s ON s.id = o.supplier_id
        ORDER BY o.created_at DESC LIMIT 100`,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Receive: marks the order received AND auto-stocks matching ingredients.
router.post('/orders/:id/receive', async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `UPDATE vendor_orders SET status = 'received', updated_at = now()
          WHERE id = $1 AND status = 'sent' RETURNING *`,
        [req.params.id],
      );
      if (!rows[0]) throw new ApiError(409, 'Order is not in "sent" state');
      const order = rows[0];
      const items = (order.items ?? []) as { name: string; qty: number; unit: string }[];
      const stocked: { name: string; qty: number; unit: string; matched: boolean }[] = [];
      for (const it of items) {
        const { rows: ings } = await client.query(
          `SELECT id, unit FROM ingredients
            WHERE lower(name) = lower($1) AND deleted_at IS NULL
            ORDER BY created_at LIMIT 1`,
          [it.name],
        );
        if (ings[0]) {
          await client.query(
            `UPDATE ingredients SET current_stock = current_stock + $2, updated_at = now() WHERE id = $1`,
            [ings[0].id, it.qty],
          );
          await client.query(
            `INSERT INTO stock_transactions (ingredient_id, quantity_change, reason) VALUES ($1, $2, 'purchase')`,
            [ings[0].id, it.qty],
          );
          stocked.push({ name: it.name, qty: it.qty, unit: it.unit, matched: true });
        } else {
          stocked.push({ name: it.name, qty: it.qty, unit: it.unit, matched: false });
        }
      }
      await client.query('COMMIT');
      res.json({ ...order, stocked });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    next(e);
  }
});

router.post('/orders/:id/cancel', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE vendor_orders SET status = 'cancelled', updated_at = now()
        WHERE id = $1 AND status = 'sent' RETURNING *`,
      [req.params.id],
    );
    if (!rows[0]) throw new ApiError(409, 'Order is not in "sent" state');
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

export const vendorsRouter = router;

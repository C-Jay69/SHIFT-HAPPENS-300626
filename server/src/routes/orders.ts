import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, currentUser } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

const router = Router();
router.use(requireAuth);

const TAX_RATE = 0.085;

const orderItemSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  notes: z.string().optional(),
  modifiers: z.array(z.object({ name: z.string(), price: z.number().nonnegative() })).optional(),
});

const createOrderSchema = z.object({
  tableId: z.string().uuid().optional(),
  guestId: z.string().uuid().optional(),
  orderType: z.enum(['dine_in', 'takeout', 'delivery']).default('dine_in'),
  items: z.array(orderItemSchema).min(1),
});

/**
 * Connected POS Sale:
 *  - Inserts the order + line items inside a DB transaction
 *  - Deducts recipe ingredients from stock for each sold unit
 *  - Logs a stock_transaction per deduction
 *  - Fires low-stock inventory_alerts
 *  - Rolls back everything if any step fails
 */
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const body = createOrderSchema.parse(req.body);
    const user = currentUser(req);

    // 1. Create the order (sent to kitchen immediately on completion).
    const orderRes = await client.query(
      `INSERT INTO orders (table_id, guest_id, server_id, order_type, status)
       VALUES ($1, $2, $3, $4, 'sent_to_kitchen')
       RETURNING *`,
      [body.tableId ?? null, body.guestId ?? null, user.id, body.orderType],
    );
    const order = orderRes.rows[0];

    let total = 0;
    const alerts: { ingredientId: string; ingredientName: string; alert: unknown }[] = [];

    // 2. Process each line item.
    for (const item of body.items) {
      // Menu item + its recipe components (one row per ingredient, if any).
      const recipeRows = await client.query(
        `SELECT mi.id, mi.name, mi.price,
                ri.ingredient_id, ri.quantity AS ing_quantity, ri.unit
           FROM menu_items mi
           LEFT JOIN recipes r ON r.menu_item_id = mi.id
           LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
          WHERE mi.id = $1 AND mi.deleted_at IS NULL`,
        [item.menuItemId],
      );
      if (recipeRows.rowCount === 0) throw new ApiError(404, `Menu item ${item.menuItemId} not found`);

      const menuItem = recipeRows.rows[0];
      const modifierPrice = (item.modifiers ?? []).reduce((sum, m) => sum + m.price, 0);
      const unitPrice = Number(menuItem.price) + modifierPrice;

      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, modifiers, notes)
         VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''))`,
        [order.id, item.menuItemId, item.quantity, unitPrice, JSON.stringify(item.modifiers ?? []), item.notes ?? ''],
      );

      total += unitPrice * item.quantity;

      // 3. Deduct ingredients for each sold unit.
      for (let q = 0; q < item.quantity; q++) {
        for (const ing of recipeRows.rows) {
          if (!ing.ingredient_id) continue; // item has no recipe -> no deduction

          const updated = await client.query(
            `UPDATE ingredients
                SET current_stock = GREATEST(0, current_stock - $1), updated_at = now()
              WHERE id = $2 AND deleted_at IS NULL
              RETURNING id, name, current_stock, reorder_threshold`,
            [ing.ing_quantity, ing.ingredient_id],
          );
          if (updated.rowCount === 0) throw new ApiError(409, `Ingredient ${ing.ingredient_id} missing`);

          await client.query(
            `INSERT INTO stock_transactions (ingredient_id, quantity_change, reason, created_by)
             VALUES ($1, $2, 'sale_deduction', $3)`,
            [ing.ingredient_id, -ing.ing_quantity, user.id],
          );

          const row = updated.rows[0];
          if (Number(row.current_stock) <= Number(row.reorder_threshold)) {
            const alert = await client.query(
              `INSERT INTO inventory_alerts (ingredient_id, alert_type, message)
               VALUES ($1, 'low_stock', $2) RETURNING *`,
              [row.id, `${row.name} is below reorder threshold (${row.current_stock} left)`],
            );
            alerts.push({ ingredientId: row.id, ingredientName: row.name, alert: alert.rows[0] });
          }
        }
      }
    }

    // 4. Finalize totals.
    const tax = total * TAX_RATE;
    await client.query(
      'UPDATE orders SET total = $1, tax = $2 WHERE id = $3',
      [total, tax, order.id],
    );

    // 5. Mark the table occupied.
    if (body.tableId) {
      await client.query("UPDATE tables SET status = 'occupied' WHERE id = $1", [body.tableId]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      order: { ...order, total, tax, tip: 0 },
      lowStockAlerts: alerts,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*, t.name AS table_name, g.first_name, g.last_name,
              (SELECT COALESCE(json_agg(oi ORDER BY oi.created_at), '[]')
                 FROM order_items oi WHERE oi.order_id = o.id) AS items
         FROM orders o
         LEFT JOIN tables t ON t.id = o.table_id
         LEFT JOIN guests g ON g.id = o.guest_id
        ORDER BY o.created_at DESC
        LIMIT 100`,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// --- Payment (Stripe gateway is stubbed; wire STRIPE_SECRET_KEY to go live) ---
const paySchema = z.object({
  amount: z.number().positive().optional(),
  method: z.enum(['card', 'cash', 'split']).default('card'),
  stripePaymentId: z.string().optional(),
});

router.post('/:id/pay', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const body = paySchema.parse(req.body);

    const orderRes = await client.query(
      'SELECT * FROM orders WHERE id = $1 AND status != \'paid\'',
      [req.params.id],
    );
    if (!orderRes.rowCount) throw new ApiError(404, 'Order not found or already paid');
    const order = orderRes.rows[0];

    const amount = body.amount ?? Number(order.total) + Number(order.tax);
    const tx = await client.query(
      `INSERT INTO transactions (order_id, payment_method, amount, stripe_payment_id, status)
       VALUES ($1, $2, $3, $4, 'succeeded') RETURNING *`,
      [order.id, body.method, amount, body.stripePaymentId ?? null],
    );

    await client.query(
      `UPDATE orders SET status = 'paid', closed_at = now() WHERE id = $1`,
      [order.id],
    );

    // Update guest lifetime spend.
    if (order.guest_id) {
      await client.query(
        'UPDATE guests SET total_spend = total_spend + $1 WHERE id = $2',
        [amount, order.guest_id],
      );
    }

    // Free the table when a dine-in order is closed.
    if (order.table_id) {
      await client.query(
        "UPDATE tables SET status = 'dirty' WHERE id = $1 AND status = 'occupied'",
        [order.table_id],
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ transaction: tx.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

export const ordersRouter = router;

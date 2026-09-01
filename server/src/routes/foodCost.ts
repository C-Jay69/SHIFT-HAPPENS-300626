import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, currentUser } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/**
 * Food Cost Intelligence
 * ----------------------
 * Per-item COGS from recipes × ingredient unit costs, margin analysis,
 * 7-day revenue/COGS/waste rollup, and price suggestions for a target
 * margin. Units are trusted 1:1 (recipe quantity is in the ingredient's
 * unit); a mismatch flag is surfaced when units differ.
 */

router.get('/items', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const { rows } = await pool.query(
      `SELECT mi.id, mi.name, mi.price::float8 AS price, mi.is_available,
              coalesce(sum(ri.quantity * i.unit_cost), 0)::float8 AS food_cost,
              bool_or(ri.unit <> i.unit) AS unit_mismatch
         FROM menu_items mi
         LEFT JOIN recipes r            ON r.menu_item_id = mi.id
         LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
         LEFT JOIN ingredients i         ON i.id = ri.ingredient_id
        WHERE mi.deleted_at IS NULL
        GROUP BY mi.id
        ORDER BY mi.name`,
    );
    res.json(
      rows.map((r) => {
        const price = Number(r.price);
        const cost = Number(r.food_cost);
        const margin = price - cost;
        const marginPct = price > 0 ? (margin / price) * 100 : 0;
        const cogsPct = price > 0 ? (cost / price) * 100 : 0;
        return {
          id: r.id,
          name: r.name,
          price,
          food_cost: Math.round(cost * 100) / 100,
          margin: Math.round(margin * 100) / 100,
          margin_pct: Math.round(marginPct * 10) / 10,
          cogs_pct: Math.round(cogsPct * 10) / 10,
          // Industry benchmark: ≤30% healthy, 30–35% watch, >35% high
          status: cogsPct <= 30 ? 'healthy' : cogsPct <= 35 ? 'watch' : 'high',
          unit_mismatch: r.unit_mismatch === true,
          has_recipe: cost > 0 || r.unit_mismatch === true,
          is_available: r.is_available,
        };
      }),
    );
  } catch (e) {
    next(e);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const { rows: rev } = await pool.query(
      `SELECT coalesce(sum(total), 0)::float8 AS revenue
         FROM orders WHERE status = 'paid' AND created_at >= now() - interval '7 days'`,
    );
    const { rows: cogsRows } = await pool.query(
      `SELECT coalesce(sum(-st.quantity_change * i.unit_cost), 0)::float8 AS cogs
         FROM stock_transactions st
         JOIN ingredients i ON i.id = st.ingredient_id
        WHERE st.reason = 'sale_deduction' AND st.created_at >= now() - interval '7 days'`,
    );
    const { rows: waste } = await pool.query(
      `SELECT i.name,
              coalesce(sum(-st.quantity_change), 0)::float8 AS qty,
              coalesce(sum(-st.quantity_change * i.unit_cost), 0)::float8 AS cost
         FROM stock_transactions st
         JOIN ingredients i ON i.id = st.ingredient_id
        WHERE st.reason = 'waste' AND st.created_at >= now() - interval '7 days'
        GROUP BY i.name ORDER BY cost DESC LIMIT 5`,
    );
    const { rows: stock } = await pool.query(
      `SELECT coalesce(sum(current_stock * unit_cost), 0)::float8 AS value
         FROM ingredients WHERE restaurant_id = $1 AND deleted_at IS NULL`,
      [user.restaurantId],
    );
    const revenue = Number(rev[0]?.revenue ?? 0);
    const cogs = Number(cogsRows[0]?.cogs ?? 0);
    res.json({
      window_days: 7,
      revenue: Math.round(revenue * 100) / 100,
      cogs: Math.round(cogs * 100) / 100,
      blended_cogs_pct: revenue > 0 ? Math.round((cogs / revenue) * 1000) / 10 : null,
      on_hand_value: Math.round(Number(stock[0]?.value ?? 0) * 100) / 100,
      top_waste: waste.map((w) => ({
        name: w.name,
        qty: Number(w.qty),
        cost: Math.round(Number(w.cost) * 100) / 100,
      })),
    });
  } catch (e) {
    next(e);
  }
});

/** Suggested prices to reach a target margin % on items currently below it. */
router.get('/suggestions', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const target = Math.min(90, Math.max(20, Number(req.query.target ?? 70)));
    const { rows } = await pool.query(
      `SELECT mi.id, mi.name, mi.price::float8 AS price,
              coalesce(sum(ri.quantity * i.unit_cost), 0)::float8 AS food_cost
         FROM menu_items mi
         LEFT JOIN recipes r            ON r.menu_item_id = mi.id
         LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
         LEFT JOIN ingredients i         ON i.id = ri.ingredient_id
        WHERE mi.deleted_at IS NULL AND mi.is_available
        GROUP BY mi.id
        HAVING coalesce(sum(ri.quantity * i.unit_cost), 0) > 0
        ORDER BY mi.name`,
    );
    const suggestions = rows
      .map((r) => {
        const cost = Number(r.food_cost);
        const price = Number(r.price);
        const suggested = Math.round((cost / (1 - target / 100)) * 100) / 100;
        return {
          id: r.id,
          name: r.name,
          current_price: price,
          food_cost: Math.round(cost * 100) / 100,
          current_margin_pct: Math.round(((price - cost) / price) * 1000) / 10,
          suggested_price: suggested,
          increase: Math.round((suggested - price) * 100) / 100,
        };
      })
      .filter((s) => s.current_margin_pct < target);
    res.json({ target_margin_pct: target, suggestions });
  } catch (e) {
    next(e);
  }
});

export const foodCostRouter = router;

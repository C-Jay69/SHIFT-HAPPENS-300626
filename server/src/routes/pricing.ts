import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, currentUser } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

const router = Router();
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Rule engine
// ---------------------------------------------------------------------------

interface PricingRule {
  id: string;
  name: string;
  type: 'peak_hours' | 'happy_hour' | 'weekend' | 'low_stock';
  multiplier: number;
  config: { start?: string; end?: string; days?: number[]; ingredient_id?: string };
  active: boolean;
}

const toMin = (t: string) => {
  const [h, m] = String(t).split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** True when curMin is inside [start,end), supporting overnight windows. */
const withinWindow = (curMin: number, start?: string, end?: string): boolean => {
  if (!start || !end) return false;
  const s = toMin(start);
  const e = toMin(end);
  return e > s ? curMin >= s && curMin < e : curMin >= s || curMin < e;
};

/** Does a time-based rule match the given date/time? */
const timeRuleMatches = (rule: PricingRule, date: Date, timeMin: number): boolean => {
  const cfg = rule.config ?? {};
  const day = date.getDay();
  if (rule.type === 'weekend') {
    const days = Array.isArray(cfg.days) && cfg.days.length ? cfg.days : [5, 6];
    return days.includes(day);
  }
  // peak_hours / happy_hour
  const days = Array.isArray(cfg.days) && cfg.days.length ? cfg.days : [0, 1, 2, 3, 4, 5, 6];
  if (!days.includes(day)) return false;
  return withinWindow(timeMin, cfg.start, cfg.end);
};

const ruleReason = (rule: PricingRule): string => {
  const cfg = rule.config ?? {};
  if (rule.type === 'low_stock') return cfg.ingredient_id ? 'specific ingredient low' : 'an ingredient is at/below threshold';
  if (rule.type === 'weekend') return 'weekend';
  return `${cfg.start ?? '?'}–${cfg.end ?? '?'}${Array.isArray(cfg.days) && cfg.days.length ? `, days ${cfg.days.join('/')}` : ''}`;
};

// ---------------------------------------------------------------------------
// Quote: effective price per menu item for a date/time
// ---------------------------------------------------------------------------

router.get('/quote', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const dateStr = String(req.query.date ?? new Date().toISOString().slice(0, 10));
    const timeStr = String(req.query.time ?? new Date().toTimeString().slice(0, 5));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(timeStr)) {
      throw new ApiError(400, 'date=YYYY-MM-DD and time=HH:MM');
    }
    const date = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(date.getTime())) throw new ApiError(400, 'invalid date');
    const timeMin = toMin(timeStr);

    const { rows: ruleRows } = await pool.query(
      `SELECT id, name, type, multiplier::float8 AS multiplier, config, active
         FROM pricing_rules WHERE active = true ORDER BY type, name`,
    );
    const rules = ruleRows as PricingRule[];

    const { rows: itemRows } = await pool.query(
      `SELECT mi.id, mi.name, mi.price::float8 AS base_price, mi.is_available,
              array_agg(DISTINCT i.id) FILTER (WHERE i.id IS NOT NULL) AS low_ingredient_ids
         FROM menu_items mi
         LEFT JOIN recipes r      ON r.menu_item_id = mi.id
         LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
         LEFT JOIN ingredients i  ON i.id = ri.ingredient_id
        WHERE mi.deleted_at IS NULL
        GROUP BY mi.id
        ORDER BY mi.name`,
    );

    const { rows: lowRows } = await pool.query(
      `SELECT id, name FROM ingredients
        WHERE restaurant_id = $1 AND deleted_at IS NULL
          AND current_stock <= reorder_threshold AND reorder_threshold > 0`,
      [user.restaurantId],
    );
    const lowIds = new Set(lowRows.map((r) => r.id));

    const globalRules = rules.filter((r) => r.type !== 'low_stock' && timeRuleMatches(r, date, timeMin));

    const items = itemRows.map((it) => {
      const applied: { rule_id: string; name: string; multiplier: number; reason: string }[] = [];
      let factor = 1;
      for (const rule of globalRules) {
        applied.push({ rule_id: rule.id, name: rule.name, multiplier: rule.multiplier, reason: ruleReason(rule) });
        factor *= rule.multiplier;
      }
      // Low-stock surcharge rules: match when the item uses a low ingredient
      // (or the configured ingredient specifically).
      for (const rule of rules.filter((r) => r.type === 'low_stock')) {
        const configured = rule.config?.ingredient_id;
        const matches = configured
          ? (it.low_ingredient_ids as string[]).includes(configured)
          : (it.low_ingredient_ids as string[]).some((id) => lowIds.has(id));
        if (matches) {
          applied.push({ rule_id: rule.id, name: rule.name, multiplier: rule.multiplier, reason: ruleReason(rule) });
          factor *= rule.multiplier;
        }
      }
      const effective = Math.round(it.base_price * factor * 100) / 100;
      return {
        id: it.id,
        name: it.name,
        base_price: it.base_price,
        effective_price: effective,
        delta: Math.round((effective - it.base_price) * 100) / 100,
        applied: applied.length ? applied : null,
        is_available: it.is_available,
      };
    });

    res.json({
      date: dateStr,
      time: timeStr,
      rules_active: rules.length,
      items,
    });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// Demand signal: paid orders per day/hour (14 days) + top sellers
// ---------------------------------------------------------------------------

router.get('/demand', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const { rows: hourly } = await pool.query(
      `SELECT to_char(date_trunc('day', o.created_at), 'YYYY-MM-DD') AS day,
              extract(hour FROM o.created_at)::int AS hour,
              count(*)::int AS orders,
              coalesce(sum(oi.quantity), 0)::int AS items
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id AND oi.status = 'active'
        WHERE o.status = 'paid' AND o.created_at >= now() - interval '14 days'
        GROUP BY 1, 2 ORDER BY 1, 2`,
    );
    const { rows: top } = await pool.query(
      `SELECT mi.name, coalesce(sum(oi.quantity), 0)::int AS qty
         FROM order_items oi
         JOIN orders o   ON o.id = oi.order_id AND o.status = 'paid'
         JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE o.created_at >= now() - interval '14 days'
        GROUP BY mi.name ORDER BY qty DESC LIMIT 10`,
    );
    // Aggregate into 30-minute buckets per weekday for the chart.
    const buckets: Record<string, { orders: number; items: number }[]> = {};
    for (const r of hourly) {
      const day = new Date(r.day + 'T00:00:00').getDay();
      const key = String(day);
      buckets[key] = buckets[key] ?? new Array(48).fill(0).map(() => ({ orders: 0, items: 0 }));
      const bucket = Math.floor((toMin(`${String(r.hour).padStart(2, '0')}:00`) % 1440) / 30);
      buckets[key][bucket].orders += r.orders;
      buckets[key][bucket].items += r.items;
    }
    res.json({ window_days: 14, buckets, top_sellers: top });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// Rule CRUD
// ---------------------------------------------------------------------------

const ruleSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(['peak_hours', 'happy_hour', 'weekend', 'low_stock']),
  multiplier: z.number().gt(0).lt(10),
  config: z.record(z.unknown()).default({}),
});

router.get('/rules', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, type, multiplier::float8 AS multiplier, config, active, created_at, updated_at
         FROM pricing_rules ORDER BY type, name`,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/rules', requireAuth, async (req, res, next) => {
  try {
    const body = ruleSchema.parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO pricing_rules (name, type, multiplier, config)
       VALUES ($1, $2, $3, $4) RETURNING id, name, type, multiplier::float8 AS multiplier, config, active`,
      [body.name, body.type, body.multiplier, JSON.stringify(body.config)],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.patch('/rules/:id', async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(1).max(80).optional(),
      type: z.enum(['peak_hours', 'happy_hour', 'weekend', 'low_stock']).optional(),
      multiplier: z.number().gt(0).lt(10).optional(),
      config: z.record(z.unknown()).optional(),
      active: z.boolean().optional(),
    }).parse(req.body);
    const { rows } = await pool.query(
      `UPDATE pricing_rules SET
         name       = COALESCE($2, name),
         type       = COALESCE($3, type),
         multiplier = COALESCE($4, multiplier),
         config     = COALESCE($5, config),
         active     = COALESCE($6, active),
         updated_at = now()
       WHERE id = $1 RETURNING id, name, type, multiplier::float8 AS multiplier, config, active`,
      [
        req.params.id,
        body.name ?? null,
        body.type ?? null,
        body.multiplier ?? null,
        body.config ? JSON.stringify(body.config) : null,
        body.active ?? null,
      ],
    );
    if (!rows[0]) throw new ApiError(404, 'Pricing rule not found');
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.delete('/rules/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`DELETE FROM pricing_rules WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows[0]) throw new ApiError(404, 'Pricing rule not found');
    res.json({ deleted: rows[0].id });
  } catch (e) {
    next(e);
  }
});

export const pricingRouter = router;

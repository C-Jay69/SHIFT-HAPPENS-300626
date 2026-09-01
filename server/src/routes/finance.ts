import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, currentUser } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

const router = Router();
router.use(requireAuth);

/**
 * Embedded Finance
 * ----------------
 * Payroll summary (wages from shifts + tips from time_logs), pay advances
 * with an approve/repay lifecycle, and an operating-expense ledger.
 */

// ---------------------------------------------------------------------------
// Payroll summary
// ---------------------------------------------------------------------------

router.get('/payroll-summary', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const days = Math.min(90, Math.max(1, Number(req.query.days ?? 14)));
    const { rows: staff } = await pool.query(
      `SELECT id, first_name, last_name, role, hourly_rate::float8 AS rate, status
         FROM staff WHERE restaurant_id = $1 AND status <> 'terminated' ORDER BY first_name`,
      [user.restaurantId],
    );
    const { rows: shifts } = await pool.query(
      `SELECT staff_id, date, start_time, end_time FROM shifts
        WHERE staff_id IN (SELECT id FROM staff WHERE restaurant_id = $1)
          AND date >= CURRENT_DATE - make_interval(days => $2)`,
      [user.restaurantId, days],
    );
    const { rows: logs } = await pool.query(
      `SELECT staff_id, clock_in, clock_out, break_minutes, tips_declared FROM time_logs
        WHERE staff_id IN (SELECT id FROM staff WHERE restaurant_id = $1)
          AND clock_in >= now() - make_interval(days => $2)
          AND clock_out IS NOT NULL`,
      [user.restaurantId, days],
    );

    const out = staff.map((s) => {
      let scheduled = 0;
      for (const sh of shifts.filter((r) => r.staff_id === s.id)) {
        const [sh1, sm1] = String(sh.start_time).slice(0, 5).split(':').map(Number);
        const [sh2, sm2] = String(sh.end_time).slice(0, 5).split(':').map(Number);
        let mins = (sh2 + sm2 / 60) * 60 - (sh1 + sm1 / 60) * 60;
        if (mins < 0) mins += 1440;
        scheduled += mins / 60;
      }
      let worked = 0;
      let tips = 0;
      for (const l of logs.filter((r) => r.staff_id === s.id)) {
        const mins = (new Date(l.clock_out as Date).getTime() - new Date(l.clock_in as Date).getTime()) / 60_000 - Number(l.break_minutes ?? 0);
        if (mins > 0) worked += mins / 60;
        tips += Number(l.tips_declared ?? 0);
      }
      const wages = scheduled * Number(s.rate);
      return {
        staff_id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        role: s.role,
        rate: Number(s.rate),
        scheduled_hours: Math.round(scheduled * 10) / 10,
        worked_hours: Math.round(worked * 10) / 10,
        tips: Math.round(tips * 100) / 100,
        wages: Math.round(wages * 100) / 100,
        total_comp: Math.round((wages + tips) * 100) / 100,
      };
    });

    const tot = out.reduce(
      (a, m) => ({
        wages: a.wages + m.wages,
        tips: a.tips + m.tips,
        total: a.total + m.total_comp,
        hours: a.hours + m.scheduled_hours,
      }),
      { wages: 0, tips: 0, total: 0, hours: 0 },
    );
    res.json({
      window_days: days,
      staff: out,
      totals: {
        wages: Math.round(tot.wages * 100) / 100,
        tips: Math.round(tot.tips * 100) / 100,
        total: Math.round(tot.total * 100) / 100,
        scheduled_hours: Math.round(tot.hours * 10) / 10,
      },
    });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// Pay advances
// ---------------------------------------------------------------------------

router.get('/advances', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, s.first_name || ' ' || s.last_name AS staff_name
         FROM finance_advances a
         JOIN staff s ON s.id = a.staff_id
        ORDER BY a.created_at DESC LIMIT 100`,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/advances', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const body = z.object({
      staffId: z.string().uuid(),
      amount: z.number().positive().max(100000),
      reason: z.string().max(300).optional(),
    }).parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO finance_advances (staff_id, amount, reason, requested_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [body.staffId, body.amount, body.reason ?? null, user.id],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

const advanceTransition = (action: 'approve' | 'reject' | 'repay') => async (req: any, res: any, next: any) => {
  try {
    const toStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'repaid';
    const fromStatus = action === 'repay' ? 'approved' : 'pending';
    const { rows } = await pool.query(
      `UPDATE finance_advances SET
         status = $2,
         approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE approved_at END,
         repaid_at = CASE WHEN $2 = 'repaid' THEN now() ELSE repaid_at END
       WHERE id = $1 AND status = $3 RETURNING *`,
      [req.params.id, toStatus, fromStatus],
    );
    if (!rows[0]) throw new ApiError(409, `Advance is not in the right state for "${action}"`);
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
};

router.post('/advances/:id/approve', advanceTransition('approve'));
router.post('/advances/:id/reject', advanceTransition('reject'));
router.post('/advances/:id/repay', advanceTransition('repay'));

// ---------------------------------------------------------------------------
// Operating expenses
// ---------------------------------------------------------------------------

const CATEGORIES = ['supplies', 'utilities', 'maintenance', 'marketing', 'payroll', 'other'] as const;

router.get('/expenses', async (req, res, next) => {
  try {
    const category = req.query.category ? String(req.query.category) : undefined;
    const { rows } = category
      ? await pool.query(`SELECT * FROM finance_expenses WHERE category = $1 ORDER BY created_at DESC LIMIT 200`, [category])
      : await pool.query(`SELECT * FROM finance_expenses ORDER BY created_at DESC LIMIT 200`);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/expenses', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const body = z.object({
      category: z.enum(CATEGORIES),
      vendor: z.string().max(120).optional(),
      amount: z.number().min(0).max(10000000),
      notes: z.string().max(500).optional(),
    }).parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO finance_expenses (restaurant_id, category, vendor, amount, notes, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user.restaurantId, body.category, body.vendor ?? null, body.amount, body.notes ?? null, user.id],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.delete('/expenses/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`DELETE FROM finance_expenses WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows[0]) throw new ApiError(404, 'Expense not found');
    res.json({ deleted: rows[0].id });
  } catch (e) {
    next(e);
  }
});

router.get('/expense-summary', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const days = Math.min(365, Math.max(1, Number(req.query.days ?? 30)));
    const { rows } = await pool.query(
      `SELECT category, count(*)::int AS n, sum(amount)::float8 AS total
         FROM finance_expenses
        WHERE restaurant_id = $1 AND created_at >= now() - make_interval(days => $2)
        GROUP BY category ORDER BY total DESC`,
      [user.restaurantId, days],
    );
    res.json({ window_days: days, by_category: rows });
  } catch (e) {
    next(e);
  }
});

export const financeRouter = router;

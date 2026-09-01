import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, currentUser } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/**
 * Employee Retention Analytics
 * ----------------------------
 * Computes tenure, load, tip trend, and a 0–100 churn-risk score per staff
 * member from shifts + time_logs + staff. No new tables — pure analytics.
 */

const DAY_MS = 86_400_000;

/** node-pg returns DATE columns as Date objects (UTC midnight); normalize to YYYY-MM-DD. */
const isoDay = (d: unknown): string | null => {
  if (d == null) return null;
  const dt = d instanceof Date ? d : new Date(String(d));
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
};

const riskFactors = (m: {
  weekly_hours_avg: number;
  longest_streak: number;
  tip_trend_pct: number | null;
  status: string;
  tenure_days: number | null;
}): { score: number; factors: string[] } => {
  let score = 0;
  const factors: string[] = [];
  if (m.weekly_hours_avg > 35) {
    score += 30;
    factors.push(`High load: ${m.weekly_hours_avg}h/wk avg`);
  } else if (m.weekly_hours_avg > 28) {
    score += 15;
    factors.push(`Elevated load: ${m.weekly_hours_avg}h/wk avg`);
  }
  if (m.longest_streak >= 5) {
    score += 20;
    factors.push(`${m.longest_streak} consecutive shifts in last 14 days`);
  }
  if (m.tip_trend_pct !== null && m.tip_trend_pct < -10) {
    score += 15;
    factors.push(`Tips declining ${Math.abs(m.tip_trend_pct)}%`);
  }
  if (m.status === 'on_leave') {
    score += 10;
    factors.push('On leave');
  }
  if (m.tenure_days !== null && m.tenure_days < 90) {
    score += 10;
    factors.push(`Early tenure (${m.tenure_days}d)`);
  }
  return { score: Math.min(100, score), factors };
};

router.get('/overview', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const { rows: staff } = await pool.query(
      `SELECT id, first_name, last_name, role, hire_date, status, hourly_rate::float8 AS hourly_rate
         FROM staff WHERE restaurant_id = $1 AND status <> 'terminated'
        ORDER BY first_name`,
      [user.restaurantId],
    );
    const { rows: shifts } = await pool.query(
      `SELECT staff_id, date, start_time, end_time
         FROM shifts
        WHERE staff_id IN (SELECT id FROM staff WHERE restaurant_id = $1)
          AND date >= (CURRENT_DATE - 14)
        ORDER BY date`,
      [user.restaurantId],
    );
    const { rows: logs } = await pool.query(
      `SELECT staff_id, clock_in, clock_out, break_minutes, tips_declared
         FROM time_logs
        WHERE staff_id IN (SELECT id FROM staff WHERE restaurant_id = $1)
          AND clock_in >= now() - interval '30 days'
          AND clock_out IS NOT NULL
        ORDER BY clock_in`,
      [user.restaurantId],
    );

    const today = new Date().toISOString().slice(0, 10);
    const out = staff.map((s) => {
      const sShifts = shifts.filter((r) => r.staff_id === s.id);
      const sLogs = logs.filter((r) => r.staff_id === s.id);

      // Weekly scheduled hours (last 14 days → 2 weeks)
      let totalHours = 0;
      for (const sh of sShifts) {
        const [sh1, sm1] = String(sh.start_time).slice(0, 5).split(':').map(Number);
        const [sh2, sm2] = String(sh.end_time).slice(0, 5).split(':').map(Number);
        let mins = (sh2 + sm2 / 60) * 60 - (sh1 + sm1 / 60) * 60;
        if (mins < 0) mins += 1440; // overnight shift
        totalHours += mins / 60;
      }
      const weekly_hours_avg = Math.round((totalHours / 2) * 10) / 10;

      // Longest consecutive-work-day streak in the last 14 days
      const days = [...new Set(sShifts.map((r) => isoDay(r.date)).filter((d): d is string => d !== null))].sort();
      let longest_streak = 0;
      let run = 0;
      let prev: number | null = null;
      for (const d of days) {
        const t = new Date(d + 'T00:00:00').getTime();
        run = prev !== null && t - prev === DAY_MS ? run + 1 : 1;
        prev = t;
        longest_streak = Math.max(longest_streak, run);
      }

      // Tips: last 30 days split in two 15-day halves; hours from time_logs
      let recent = 0;
      let prior = 0;
      let hoursWorked = 0;
      for (const l of sLogs) {
        const t = new Date(l.clock_in as Date).getTime();
        const tips = Number(l.tips_declared ?? 0);
        if (t >= Date.now() - 15 * DAY_MS) recent += tips;
        else prior += tips;
        const mins =
          (new Date(l.clock_out as Date).getTime() - new Date(l.clock_in as Date).getTime()) / 60_000 -
          Number(l.break_minutes ?? 0);
        if (mins > 0) hoursWorked += mins / 60;
      }
      const tip_trend_pct =
        prior > 0 ? Math.round(((recent - prior) / prior) * 100) : recent > 0 ? 100 : null;

      const hireIso = isoDay(s.hire_date);
      const tenure_days = hireIso
        ? Math.max(0, Math.floor((Date.now() - new Date(hireIso + 'T00:00:00Z').getTime()) / DAY_MS))
        : null;

      const { score, factors } = riskFactors({ weekly_hours_avg, longest_streak, tip_trend_pct, status: s.status, tenure_days });

      return {
        staff_id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        role: s.role,
        status: s.status,
        tenure_days,
        weekly_hours_avg,
        longest_streak,
        shifts_14d: sShifts.length,
        tips_30d: Math.round((recent + prior) * 100) / 100,
        tip_trend_pct,
        hours_logged_30d: Math.round(hoursWorked * 10) / 10,
        risk_score: score,
        risk_level: score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low',
        factors,
        as_of: today,
      };
    });

    const atRisk = out.filter((m) => m.risk_level !== 'low');
    res.json({
      as_of: today,
      staff: out,
      aggregate: {
        headcount: out.length,
        at_risk: atRisk.length,
        avg_tenure_days: (() => {
          const withTenure = out.filter((m) => m.tenure_days !== null);
          return withTenure.length
            ? Math.round(withTenure.reduce((a, m) => a + (m.tenure_days ?? 0), 0) / withTenure.length)
            : 0;
        })(),
        avg_risk_score: out.length ? Math.round(out.reduce((a, m) => a + m.risk_score, 0) / out.length) : 0,
      },
    });
  } catch (e) {
    next(e);
  }
});

export const retentionRouter = router;

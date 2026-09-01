import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, currentUser } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

const router = Router();
router.use(requireAuth);

// HACCP thresholds: cold storage ≤ 4 °C, hot holding ≥ 60 °C.
const COLD_MAX = 4;
const HOT_MIN = 60;

const isColdStation = (s?: string | null) => /freezer|fridge|cold|walk[- ]?in|refrigerat/i.test(s ?? '');
const isHotStation = (s?: string | null) => /hot|grill|steam|fryer|fry|sauce/i.test(s ?? '');

/** Auto-flag out-of-range temperature readings at write time. */
function evaluate(type: string, station: string | null | undefined, celsius: number | null | undefined, notes?: string | null): { status: 'ok' | 'flagged'; notes: string | null } {
  if (type === 'incident') {
    return { status: 'flagged', notes: notes ?? 'Incident reported' };
  }
  if (type === 'temperature' && celsius !== null && celsius !== undefined) {
    if (isColdStation(station) && celsius > COLD_MAX) {
      return {
        status: 'flagged',
        notes: `Cold storage ${celsius} °C exceeds ${COLD_MAX} °C limit — move product, check equipment`,
      };
    }
    if (isHotStation(station) && celsius < HOT_MIN) {
      return {
        status: 'flagged',
        notes: `Hot holding ${celsius} °C below ${HOT_MIN} °C minimum — reheat or discard per policy`,
      };
    }
  }
  return { status: 'ok', notes: notes ?? null };
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

const logSchema = z.object({
  type: z.enum(['temperature', 'cleaning', 'incident']),
  station: z.string().max(120).nullable().optional(),
  celsius: z.number().min(-40).max(120).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

router.post('/logs', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const body = logSchema.parse(req.body);
    const evalr = evaluate(body.type, body.station ?? null, body.celsius ?? null, body.notes ?? null);
    const { rows } = await pool.query(
      `INSERT INTO haccp_logs (restaurant_id, type, station, celsius, status, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        user.restaurantId,
        body.type,
        body.station ?? null,
        body.celsius ?? null,
        evalr.status,
        evalr.notes,
        user.id,
      ],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.get('/logs', async (req, res, next) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
    const { type, status } = req.query as Record<string, string | undefined>;
    const where: string[] = [];
    const params: unknown[] = [];
    if (type) {
      params.push(type);
      where.push(`type = $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    params.push(limit);
    const { rows } = await pool.query(
      `SELECT * FROM haccp_logs
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.patch('/logs/:id', async (req, res, next) => {
  try {
    const body = z
      .object({ status: z.enum(['ok', 'flagged', 'resolved']).optional(), notes: z.string().max(500).nullable().optional() })
      .parse(req.body);
    const { rows } = await pool.query(
      `UPDATE haccp_logs SET
         status      = COALESCE($2, status),
         notes       = COALESCE($3, notes),
         resolved_at = CASE WHEN $2 = 'resolved' THEN now() ELSE resolved_at END
       WHERE id = $1 RETURNING *`,
      [req.params.id, body.status ?? null, body.notes ?? null],
    );
    if (!rows[0]) throw new ApiError(404, 'HACCP log not found');
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// Summary: open flags, 14-day trend, recent activity
// ---------------------------------------------------------------------------

router.get('/summary', async (req, res, next) => {
  try {
    const { rows: openFlags } = await pool.query(
      `SELECT count(*)::int AS n FROM haccp_logs WHERE status = 'flagged'`,
    );
    const { rows: trend } = await pool.query(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
              count(*) FILTER (WHERE status = 'ok')::int AS ok,
              count(*) FILTER (WHERE status = 'flagged')::int AS flagged
         FROM haccp_logs
        WHERE created_at >= now() - interval '14 days'
        GROUP BY 1 ORDER BY 1`,
    );
    const { rows: recent } = await pool.query(
      `SELECT * FROM haccp_logs ORDER BY created_at DESC LIMIT 10`,
    );
    const { rows: temps } = await pool.query(
      `SELECT station, celsius::float8 AS celsius, created_at
         FROM haccp_logs
        WHERE type = 'temperature' AND created_at >= now() - interval '14 days'
        ORDER BY created_at DESC LIMIT 20`,
    );
    res.json({
      open_flags: Number(openFlags[0]?.n ?? 0),
      threshold_cold_max_c: COLD_MAX,
      threshold_hot_min_c: HOT_MIN,
      trend_14d: trend,
      recent_temps: temps,
      recent_logs: recent,
    });
  } catch (e) {
    next(e);
  }
});

export const haccpRouter = router;

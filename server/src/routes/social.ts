import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, currentUser } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { openrouterChat, openrouterAvailable } from '../lib/openrouter.js';

const router = Router();
router.use(requireAuth);

const PLATFORMS = ['instagram', 'facebook', 'x', 'generic'] as const;

const postSchema = z.object({
  platform: z.enum(PLATFORMS).default('generic'),
  content: z.string().min(3).max(1000),
  scheduledAt: z.string().datetime().nullable().optional(),
});

// ---------------------------------------------------------------------------
// List / create / edit / delete
// ---------------------------------------------------------------------------

router.get('/posts', async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const { rows } = status
      ? await pool.query(
          `SELECT * FROM social_posts WHERE status = $1 ORDER BY coalesce(scheduled_at, created_at) DESC LIMIT 100`,
          [status],
        )
      : await pool.query(`SELECT * FROM social_posts ORDER BY coalesce(scheduled_at, created_at) DESC LIMIT 100`);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/posts', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const body = postSchema.parse(req.body);
    const scheduledAt = body.scheduledAt ?? null;
    const status = scheduledAt && new Date(scheduledAt).getTime() > Date.now() ? 'scheduled' : 'draft';
    const { rows } = await pool.query(
      `INSERT INTO social_posts (restaurant_id, platform, content, source, status, scheduled_at, created_by)
       VALUES ($1, $2, $3, 'manual', $4, $5, $6) RETURNING *`,
      [user.restaurantId, body.platform, body.content, status, scheduledAt, user.id],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.patch('/posts/:id', async (req, res, next) => {
  try {
    const body = z
      .object({
        platform: z.enum(PLATFORMS).optional(),
        content: z.string().min(3).max(1000).optional(),
        scheduledAt: z.string().datetime().nullable().optional(),
        status: z.enum(['draft', 'scheduled']).optional(),
      })
      .parse(req.body);
    const { rows } = await pool.query(
      `UPDATE social_posts SET
         platform     = COALESCE($2, platform),
         content      = COALESCE($3, content),
         scheduled_at = COALESCE($4, scheduled_at),
         status       = COALESCE($5, status)
       WHERE id = $1 RETURNING *`,
      [
        req.params.id,
        body.platform ?? null,
        body.content ?? null,
        body.scheduledAt !== undefined ? (body.scheduledAt ?? null) : null,
        body.status ?? null,
      ],
    );
    if (!rows[0]) throw new ApiError(404, 'Post not found');
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.delete('/posts/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`DELETE FROM social_posts WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows[0]) throw new ApiError(404, 'Post not found');
    res.json({ deleted: rows[0].id });
  } catch (e) {
    next(e);
  }
});

// Publish: marks published + timestamp. External network posting hooks into
// this same endpoint (platform tokens are per-installation secrets).
router.post('/posts/:id/publish', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE social_posts SET status = 'published', published_at = now()
        WHERE id = $1 RETURNING *`,
      [req.params.id],
    );
    if (!rows[0]) throw new ApiError(404, 'Post not found');
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// Idea generation: LLM when configured, deterministic templates otherwise.
// Both produce 3 ready-to-edit drafts from live restaurant data.
// ---------------------------------------------------------------------------

async function gatherContext(restaurantId: string | null) {
  if (!restaurantId) {
    return { name: 'our restaurant', items: [] as string[], reservationsToday: 0, eventLeadType: null };
  }
  const { rows: rest } = await pool.query(`SELECT name FROM restaurants WHERE id = $1`, [restaurantId]);
  const { rows: menu } = await pool.query(
    `SELECT name FROM menu_items WHERE is_available AND deleted_at IS NULL ORDER BY name LIMIT 5`,
  );
  const { rows: resv } = await pool.query(
    `SELECT count(*)::int AS n FROM reservations
      WHERE date::date = CURRENT_DATE AND status IN ('confirmed', 'pending')`,
  );
  const { rows: lead } = await pool.query(
    `SELECT event_type FROM event_leads WHERE restaurant_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [restaurantId],
  );
  return {
    name: rest[0]?.name ?? 'our restaurant',
    items: menu.map((m) => m.name),
    reservationsToday: Number(resv[0]?.n ?? 0),
    eventLeadType: lead[0]?.event_type ?? null,
  };
}

function templatePosts(c: { name: string; items: string[]; reservationsToday: number; eventLeadType: string | null }): { platform: (typeof PLATFORMS)[number]; content: string }[] {
  const dishes = c.items.slice(0, 3);
  return [
    {
      platform: 'instagram',
      content:
        dishes.length >= 2
          ? `🔥 Tonight at ${c.name}: ${dishes.join(', ')}. Come hungry — walk-ins welcome. #foodie #dinner #${c.name.replace(/\s+/g, '')}`
          : `🔥 Dinner service starts soon at ${c.name}. Come hungry — walk-ins welcome. #foodie #dinner`,
    },
    {
      platform: 'facebook',
      content:
        c.reservationsToday > 0
          ? `📅 ${c.reservationsToday} tables already confirmed for tonight at ${c.name}. Spots are filling fast — book yours!`
          : `📅 Planning tonight? Tables at ${c.name} are still open — reserve now or just stop by.`,
    },
    {
      platform: 'x',
      content:
        c.eventLeadType
          ? `🎉 Planning a ${c.eventLeadType.replace(/_/g, ' ')}? ${c.name} does catering from intimate dinners to big celebrations. DM us for a quote. #catering`
          : `🎉 Catering inquiries open at ${c.name} — from private dinners to big celebrations. DM us for a quote. #catering`,
    },
  ];
}

router.post('/generate', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const body = z
      .object({ occasion: z.string().max(120).optional() })
      .parse(req.body ?? {});
    const c = await gatherContext(user.restaurantId);

    let posts: { platform: (typeof PLATFORMS)[number]; content: string }[] | null = null;
    let source: 'llm' | 'template' = 'template';

    if (openrouterAvailable()) {
      const systemPrompt =
        'You write short, punchy social media posts for a restaurant. You output strict JSON: an array of 3 objects {platform: "instagram"|"facebook"|"x", content: string}. Max 280 chars each, max 3 hashtags, no URLs.';
      const llm = await openrouterChat(
        `Restaurant: ${c.name}\nAvailable dishes: ${c.items.join(', ') || 'none listed'}\nReservations today: ${c.reservationsToday}\n` +
          (body.occasion ? `Occasion/theme: ${body.occasion}\n` : '') +
          'Write 3 distinct posts (one per platform) promoting the restaurant.',
        systemPrompt,
      );
      if (llm) {
        try {
          const jsonStart = llm.indexOf('[');
          const parsed = JSON.parse(llm.slice(jsonStart === -1 ? 0 : jsonStart)) as {
            platform?: string;
            content?: string;
          }[];
          if (Array.isArray(parsed) && parsed.length) {
            posts = parsed
              .filter((p) => p.content && typeof p.content === 'string')
              .slice(0, 3)
              .map((p) => ({
                platform: (PLATFORMS as readonly string[]).includes(String(p.platform))
                  ? (p.platform as (typeof PLATFORMS)[number])
                  : 'generic',
                content: String(p.content).slice(0, 1000),
              }));
            source = 'llm';
          }
        } catch {
          posts = null; // fall through to templates
        }
      }
    }
    posts = posts ?? templatePosts(c);

    const inserted = await Promise.all(
      posts.map(async (p) => {
        const { rows } = await pool.query(
          `INSERT INTO social_posts (restaurant_id, platform, content, source, status, created_by)
           VALUES ($1, $2, $3, $4, 'draft', $5) RETURNING *`,
          [user.restaurantId, p.platform, p.content, source, user.id],
        );
        return rows[0];
      }),
    );
    res.status(201).json({ source, posts: inserted });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

router.get('/stats', async (req, res, next) => {
  try {
    const { rows: byStatus } = await pool.query(
      `SELECT status, count(*)::int AS n FROM social_posts GROUP BY status`,
    );
    const { rows: byPlatform } = await pool.query(
      `SELECT platform, count(*)::int AS n FROM social_posts GROUP BY platform ORDER BY n DESC`,
    );
    const { rows: nextRow } = await pool.query(
      `SELECT id, platform, content, scheduled_at FROM social_posts
        WHERE status = 'scheduled' AND scheduled_at > now()
        ORDER BY scheduled_at ASC LIMIT 1`,
    );
    res.json({
      by_status: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
      by_platform: Object.fromEntries(byPlatform.map((r) => [r.platform, r.n])),
      next_scheduled: nextRow[0] ?? null,
    });
  } catch (e) {
    next(e);
  }
});

export const socialRouter = router;

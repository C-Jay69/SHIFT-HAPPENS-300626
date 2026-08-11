import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, currentUser, requirePermission } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { ingestKnowledge, searchKnowledgeBase } from '../lib/knowledgeBase.js';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('ai.configure'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, category, question, answer, created_at FROM knowledge_base ORDER BY created_at DESC LIMIT 500',
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/', requirePermission('ai.configure'), async (req, res, next) => {
  try {
    const user = currentUser(req);
    const body = z
      .object({ category: z.string().min(1), answer: z.string().min(1), question: z.string().optional() })
      .parse(req.body);
    const entry = await ingestKnowledge(user.restaurantId!, body.category, body.answer, body.question);
    res.status(201).json(entry);
  } catch (e) {
    next(e);
  }
});

// Auto-ingest the menu + opening hours so the phone agent knows the restaurant.
router.post('/ingest-menu', requirePermission('ai.configure'), async (req, res, next) => {
  try {
    const user = currentUser(req);
    if (!user.restaurantId) throw new ApiError(400, 'User has no restaurant');

    const [menu, restaurant] = await Promise.all([
      pool.query(
        `SELECT mi.name, mi.description, mi.price, mc.name AS category
           FROM menu_items mi
           JOIN menu_categories mc ON mc.id = mi.category_id
          WHERE mi.deleted_at IS NULL`,
      ),
      pool.query('SELECT name, settings FROM restaurants WHERE id = $1', [user.restaurantId]),
    ]);

    const entries: unknown[] = [];
    for (const item of menu.rows) {
      const answer = `${item.name} — ${item.price} (${item.category}). ${item.description ?? ''}`.trim();
      entries.push(await ingestKnowledge(user.restaurantId, 'menu', answer, `What is the ${item.name}?`));
    }

    const settings = restaurant.rows[0]?.settings ?? {};
    if (settings.hours) {
      entries.push(await ingestKnowledge(user.restaurantId, 'hours', JSON.stringify(settings.hours), 'What are your hours?'));
    }

    res.status(201).json({ ingested: entries.length });
  } catch (e) {
    next(e);
  }
});

router.post('/search', async (req, res, next) => {
  try {
    const user = currentUser(req);
    if (!user.restaurantId) throw new ApiError(400, 'User has no restaurant');
    const body = z.object({ query: z.string().min(1), topK: z.number().int().min(1).max(20).optional() }).parse(req.body);
    const results = await searchKnowledgeBase(user.restaurantId, body.query, body.topK ?? 5);
    res.json(results);
  } catch (e) {
    next(e);
  }
});

export const knowledgeBaseRouter = router;

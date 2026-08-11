import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, currentUser, requirePermission } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { ingestKnowledge, searchKnowledgeBase } from '../lib/knowledgeBase.js';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('ai.configure'), async (req, res, next) => {
  try {
    const user = currentUser(req);
    const { rows } = await pool.query(
      'SELECT id, category, question, answer, created_at FROM knowledge_base WHERE restaurant_id = $1 ORDER BY created_at DESC LIMIT 500',
      [user.restaurantId],
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

const updateSchema = z.object({
  category: z.string().min(1).optional(),
  question: z.string().nullable().optional(),
  answer: z.string().min(1).optional(),
});

router.patch('/:id', requirePermission('ai.configure'), async (req, res, next) => {
  try {
    const user = currentUser(req);
    const body = updateSchema.parse(req.body);
    const sets: string[] = [];
    const values: unknown[] = [req.params.id, user.restaurantId];
    const map: Record<string, unknown> = {
      category: body.category,
      question: body.question === undefined ? undefined : (body.question || null),
      answer: body.answer,
    };
    for (const key of Object.keys(map)) {
      if (map[key] !== undefined) {
        sets.push(`${key} = $${values.length + 1}`);
        values.push(map[key]);
      }
    }
    if (sets.length === 0) throw new ApiError(400, 'No fields to update');

    const { rows } = await pool.query(
      `UPDATE knowledge_base SET ${sets.join(', ')} WHERE id = $1 AND restaurant_id = $2 RETURNING id, category, question, answer`,
      values,
    );
    if (!rows[0]) throw new ApiError(404, 'Knowledge base entry not found');
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requirePermission('ai.configure'), async (req, res, next) => {
  try {
    const user = currentUser(req);
    const { rowCount } = await pool.query(
      'DELETE FROM knowledge_base WHERE id = $1 AND restaurant_id = $2',
      [req.params.id, user.restaurantId],
    );
    if (!rowCount) throw new ApiError(404, 'Knowledge base entry not found');
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export const knowledgeBaseRouter = router;

import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, requirePermission, currentUser } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

const router = Router();
router.use(requireAuth);

// --- Categories ---

router.get('/categories', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM menu_categories ORDER BY display_order ASC, name ASC',
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/categories', requirePermission('menu.manage'), async (req, res, next) => {
  try {
    const body = z.object({ name: z.string().min(1), displayOrder: z.number().int().optional() }).parse(req.body);
    const user = currentUser(req);
    const { rows } = await pool.query(
      'INSERT INTO menu_categories (restaurant_id, name, display_order) VALUES ($1, $2, $3) RETURNING *',
      [user.restaurantId, body.name, body.displayOrder ?? 0],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// --- Items (with recipes) ---

router.get('/items', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT mi.*, mc.name AS category_name,
              (SELECT COALESCE(json_agg(json_build_object(
                 'ingredientId', ri.ingredient_id,
                 'ingredientName', i.name,
                 'quantity', ri.quantity,
                 'unit', ri.unit
               )), '[]')
                 FROM recipes r
                 JOIN recipe_ingredients ri ON ri.recipe_id = r.id
                 JOIN ingredients i ON i.id = ri.ingredient_id
                WHERE r.menu_item_id = mi.id) AS recipe
         FROM menu_items mi
         JOIN menu_categories mc ON mc.id = mi.category_id
        WHERE mi.deleted_at IS NULL
        ORDER BY mi.name ASC`,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

const itemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().nonnegative(),
  imageUrl: z.string().optional(),
  isAvailable: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  recipe: z.array(z.object({ ingredientId: z.string().uuid(), quantity: z.number().positive(), unit: z.string() })).optional(),
});

router.post('/items', requirePermission('menu.manage'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const body = itemSchema.parse(req.body);

    const { rows } = await client.query(
      `INSERT INTO menu_items (category_id, name, description, price, image_url, is_available, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [body.categoryId, body.name, body.description ?? null, body.price, body.imageUrl ?? null, body.isAvailable ?? true, JSON.stringify(body.tags ?? [])],
    );

    if (body.recipe && body.recipe.length > 0) {
      const recipe = await client.query(
        'INSERT INTO recipes (menu_item_id) VALUES ($1) RETURNING id',
        [rows[0].id],
      );
      for (const ing of body.recipe) {
        await client.query(
          `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
           VALUES ($1, $2, $3, $4)`,
          [recipe.rows[0].id, ing.ingredientId, ing.quantity, ing.unit],
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

router.patch('/items/:id', requirePermission('menu.manage'), async (req, res, next) => {
  try {
    const body = itemSchema.partial().parse(req.body);
    let sets = Object.keys(body)
      .filter((k) => !['recipe', 'tags'].includes(k))
      .map((key, i) => `${key} = $${i + 2}`)
      .join(', ');
    const values = Object.entries(body)
      .filter(([k]) => !['recipe', 'tags'].includes(k))
      .map(([, v]) => v);

    if (body.tags) {
      values.push(JSON.stringify(body.tags));
      sets += sets ? ', tags = $' + (values.length) : 'tags = $2';
    }

    const { rows } = await pool.query(
      `UPDATE menu_items SET ${sets}, updated_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [req.params.id, ...values],
    );
    if (!rows[0]) throw new ApiError(404, 'Menu item not found');
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.delete('/items/:id', requirePermission('menu.manage'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'UPDATE menu_items SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [req.params.id],
    );
    if (!rows[0]) throw new ApiError(404, 'Menu item not found');
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export const menuRouter = router;

import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  roleId: z.string().uuid(),
  restaurantId: z.string().uuid().optional(),
});

router.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [body.email]);
    if (existing.rowCount) {
      throw new ApiError(409, 'Email already registered');
    }

    const passwordHash = await hashPassword(body.password);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, role_id, restaurant_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, role_id, restaurant_id`,
      [body.email, passwordHash, body.roleId, body.restaurantId],
    );

    const user = rows[0];
    res.status(201).json({
      token: signToken({
        sub: user.id,
        email: user.email,
        role: 'user',
        restaurantId: user.restaurant_id,
      }),
      user,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);

    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.restaurant_id, r.name AS role, r.permissions
         FROM users u
         JOIN roles r ON r.id = u.role_id
        WHERE u.email = $1`,
      [body.email],
    );

    const user = rows[0];
    if (!user || !(await verifyPassword(body.password, user.password_hash))) {
      throw new ApiError(401, 'Invalid credentials');
    }

    res.json({
      token: signToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        restaurantId: user.restaurant_id,
      }),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        restaurantId: user.restaurant_id,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.get('/me', requireAuth, (req, res) => res.json(req.user));

export const authRouter = router;

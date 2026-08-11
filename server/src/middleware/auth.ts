import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { ApiError } from './error.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        permissions: string[];
        restaurantId: string | null;
      };
    }
  }
}

const JWT_SECRET =
  process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET || 'dev-secret-change-me';

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  restaurantId: string | null;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export const currentUser = (req: Request) => {
  if (!req.user) {
    throw new ApiError(401, 'Unauthorized');
  }
  return req.user;
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Missing bearer token'));
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as TokenPayload;

    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.restaurant_id, r.name AS role, r.permissions
         FROM users u
         JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1`,
      [payload.sub],
    );

    if (!rows[0]) {
      throw new Error('User not found');
    }

    req.user = {
      id: rows[0].id as string,
      email: rows[0].email as string,
      role: rows[0].role as string,
      permissions: (rows[0].permissions as string[]) ?? [],
      restaurantId: rows[0].restaurant_id as string | null,
    };
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired token'));
  }
};

export const requirePermission =
  (permission: string) => (req: Request, _res: Response, next: NextFunction) => {
    const perms: string[] = req.user?.permissions ?? [];
    if (!perms.includes('*') && !perms.includes(permission)) {
      return next(new ApiError(403, 'Insufficient permissions'));
    }
    next();
  };

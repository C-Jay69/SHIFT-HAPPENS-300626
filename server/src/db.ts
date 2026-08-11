import './env.js';
import pg from 'pg';

const { Pool } = pg;

const rawUrl = process.env.DATABASE_URL;

if (!rawUrl) {
  console.warn('DATABASE_URL is not set. API will start, but database routes will fail.');
}

// node-postgres does not understand `channel_binding`; strip it (Neon only
// requires it for server-rejecting clients). Keeps the pooler URL usable.
const connectionString = rawUrl
  ? rawUrl.replace(/&?channel_binding=[^&]+/, '')
  : undefined;

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const query = (text: string, params?: unknown[]) => pool.query(text, params as unknown[]);

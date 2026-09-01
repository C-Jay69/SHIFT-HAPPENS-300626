import { pool } from '../db.js';

let cached: boolean | null = null;

/**
 * Whether the pgvector extension is present on this database.
 *
 * SHIFT HAPPENS! is designed for Postgres + pgvector (docker-compose ships the
 * `pgvector/pgvector` image and Neon/Supabase have it enabled by default),
 * which powers vector RAG for the AI phone agent's knowledge base. On hosts
 * without the extension (vanilla Postgres, restricted managed DBs) the
 * knowledge base degrades to full-text keyword search instead of failing —
 * the schema is applied with a JSONB embedding column and the retrieval path
 * skips the vector operators.
 */
export async function hasPgVector(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    const { rows } = await pool.query(`SELECT 1 FROM pg_extension WHERE extname = 'vector'`);
    cached = rows.length > 0;
  } catch {
    cached = false;
  }
  return cached;
}

/** Test hook — clear the cached detection after (re)migration. */
export function resetPgVectorCache(): void {
  cached = null;
}

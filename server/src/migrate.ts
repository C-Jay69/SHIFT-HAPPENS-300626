import './env.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, '../../db/schema.sql');
const reset = process.argv.includes('--reset');

const client = await pool.connect();
try {
  const existing = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = 'restaurants'`,
  );

  if (existing.rowCount && !reset) {
    console.log('ℹ️  Schema already applied. Re-run with `--reset` to drop and recreate.');
  } else {
    if (reset || !existing.rowCount) {
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      console.log('🧹  Reset schema to a clean state.');
    }

    // pgvector is optional at the database level: on hosts without the
    // extension we apply the same schema with a JSONB embedding column and
    // without the HNSW index, so keyword RAG keeps working.
    const { rows: extCheck } = await client.query(
      `SELECT 1 FROM pg_available_extensions WHERE name = 'vector'`,
    );
    let schema = fs.readFileSync(schemaPath, 'utf8');
    if (extCheck.length === 0) {
      console.warn('⚠️  pgvector extension not available on this database.');
      console.warn('   The AI knowledge base will use keyword search instead of vector RAG.');
      schema = schema
        .replace(
          /^CREATE EXTENSION IF NOT EXISTS vector;[^\n]*/m,
          '-- CREATE EXTENSION vector (skipped: extension not available)',
        )
        .replace(/VECTOR\(1536\)/g, 'JSONB')
        .replace(
          /CREATE INDEX idx_knowledge_base_embedding[\s\S]*?;/,
          '-- CREATE INDEX idx_knowledge_base_embedding (skipped: pgvector not available)',
        );
    }

    await client.query(schema);
    console.log('✅ Schema applied successfully from', schemaPath);
  }
} catch (err) {
  console.error('❌ Failed to apply schema:', err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}

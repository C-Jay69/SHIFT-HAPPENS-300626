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
    const schema = fs.readFileSync(schemaPath, 'utf8');
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

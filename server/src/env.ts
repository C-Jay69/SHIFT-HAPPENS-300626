import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the monorepo root .env so scripts work regardless of CWD.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

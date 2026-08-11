import './env.js';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { uploadHandler, stripeWebhookHandler } from './lib/stripe.js';
import { authRouter } from './routes/auth.js';
import { guestsRouter } from './routes/guests.js';
import { reservationsRouter } from './routes/reservations.js';
import { menuRouter } from './routes/menu.js';
import { inventoryRouter } from './routes/inventory.js';
import { ordersRouter } from './routes/orders.js';
import { tablesRouter } from './routes/tables.js';
import { staffRouter } from './routes/staff.js';
import { eventsRouter } from './routes/events.js';
import { aiRouter } from './routes/ai.js';
import { knowledgeBaseRouter } from './routes/knowledgeBase.js';
import { voiceRouter } from './routes/voice.js';
import { integrationsRouter } from './routes/integrations.js';
import { errorHandler, notFound } from './middleware/error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Stripe webhooks need the raw body — register before express.json().
app.post('/api/v1/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/guests', guestsRouter);
app.use('/api/v1/reservations', reservationsRouter);
app.use('/api/v1/menu', menuRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/orders', ordersRouter);
app.use('/api/v1/tables', tablesRouter);
app.use('/api/v1/staff', staffRouter);
app.use('/api/v1/events', eventsRouter);
app.use('/api/v1/ai', aiRouter);
app.use('/api/v1/knowledge-base', knowledgeBaseRouter);
app.use('/api/v1/voice', voiceRouter);
app.use('/api/v1/integrations', integrationsRouter);
app.use('/api/v1/stripe/payment-intents', uploadHandler);

// In production the frontend build (root/dist) is served by this same process,
// so a single PORT serves the entire platform.
const webDist = path.resolve(__dirname, '../../dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist, { index: false }));
  app.get(/^\/(?!api\/|health).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`🚀 SHIFT HAPPENS! API listening on http://0.0.0.0:${PORT}`);
  if (fs.existsSync(webDist)) console.log(`📦 SPA build detected — serving frontend from ${webDist}`);
  else console.log('ℹ️  No SPA build found — run `npm run build` to serve the frontend from this port.');
});
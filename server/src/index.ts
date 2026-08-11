import './env.js';
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { guestsRouter } from './routes/guests.js';
import { reservationsRouter } from './routes/reservations.js';
import { menuRouter } from './routes/menu.js';
import { inventoryRouter } from './routes/inventory.js';
import { ordersRouter } from './routes/orders.js';
import { tablesRouter } from './routes/tables.js';
import { aiRouter } from './routes/ai.js';
import { knowledgeBaseRouter } from './routes/knowledgeBase.js';
import { voiceRouter } from './routes/voice.js';
import { errorHandler, notFound } from './middleware/error.js';

const app = express();

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
app.use('/api/v1/ai', aiRouter);
app.use('/api/v1/knowledge-base', knowledgeBaseRouter);
app.use('/api/v1/voice', voiceRouter);

app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`🚀 SHIFT HAPPENS! API listening on http://0.0.0.0:${PORT}`);
});

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, currentUser } from '../middleware/auth.js';
import { openrouterAvailable, openrouterChat } from '../lib/openrouter.js';
import { searchKnowledgeBase } from '../lib/knowledgeBase.js';

const router = Router();

router.get('/status', (_req, res) => {
  res.json({ configured: openrouterAvailable() });
});

router.use(requireAuth);

const DEFAULT_SYSTEM_PROMPT = `
You are "ShiftBot", the AI Operations Assistant for "SHIFT HAPPENS!".
Your tone is professional, efficient, but slightly witty.
You can answer questions using the restaurant knowledge base provided below.
Keep answers under 150 words unless asked for a detailed report.
Format your response with Markdown if helpful.
`.trim();

router.post('/chat', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const body = z
      .object({ message: z.string().min(1), systemPrompt: z.string().optional() })
      .parse(req.body);

    // RAG: pull the top relevant chunks for this restaurant.
    let context = '';
    if (user.restaurantId) {
      const results = await searchKnowledgeBase(user.restaurantId, body.message, 5);
      if (results.length > 0) {
        context = results.map((r) => `[${r.category}] ${r.answer}`).join('\n');
      }
    }

    const systemInstruction = [
      body.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      context ? 'Relevant restaurant knowledge:\n' + context : 'No knowledge base entries found.',
    ].join('\n\n');

    const answer = await openrouterChat(body.message, systemInstruction);
    if (!answer) {
      return res
        .status(503)
        .json({ error: 'AI is not configured. Set OPENROUTER_API_KEY on the server to enable ShiftBot.' });
    }

    res.json({ text: answer, usedKnowledgeBase: context.length > 0 });
  } catch (e) {
    next(e);
  }
});

export const aiRouter = router;

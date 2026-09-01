import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { stripeConfigured } from '../lib/payment.js';

const router = Router();
router.use(requireAuth);

interface IntegrationStatus {
  key: string;
  label: string;
  configured: boolean;
  note?: string;
}

router.get('/', async (_req, res, _next) => {
  const status: IntegrationStatus[] = [
    {
      key: 'stripe',
      label: 'Stripe (Payments)',
      configured: stripeConfigured(),
      note: process.env.STRIPE_WEBHOOK_SECRET ? 'Webhook enabled' : 'Webhook secret not set',
    },
    {
      key: 'twilio_voice',
      label: 'Twilio Voice (AI Phone Agent)',
      configured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      note: 'Point your Twilio number at POST /api/v1/voice',
    },
    {
      key: 'twilio_sms',
      label: 'Twilio SMS (Notifs)',
      configured: Boolean(
        process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER,
      ),
      note: 'Sends reservation confirmations + waitlist alerts',
    },
    {
      key: 'sendgrid',
      label: 'SendGrid (Email)',
      configured: Boolean(process.env.SENDGRID_API_KEY),
      note: 'Sends reservation + waitlist email confirmations',
    },
    {
      key: 'google_calendar',
      label: 'Google Calendar Sync',
      configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
    {
      key: 'docusign',
      label: 'DocuSign (Contracts)',
      configured: Boolean(process.env.DOCUSIGN_ACCESS_TOKEN),
    },
    {
      key: 'llm',
      label: 'LLM (ShiftBot / Voice AI / RAG)',
      configured: Boolean(process.env.OPENROUTER_API_KEY),
      note: process.env.OPENROUTER_API_KEY
        ? `Model: ${process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini'}`
        : 'Set OPENROUTER_API_KEY (any OpenAI-compatible endpoint)',
    },
    {
      key: 'maps',
      label: 'Google Places (Reviews)',
      configured: Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY),
    },
    {
      key: 'yelp',
      label: 'Yelp Fusion (Reviews)',
      configured: Boolean(process.env.YELP_API_KEY),
    },
  ];
  res.json(status);
});

export const integrationsRouter = router;
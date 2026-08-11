import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { pool } from '../db.js';
import { requireAuth, currentUser } from '../middleware/auth.js';
import { finalizePaidOrder } from '../routes/orders.js';
import { createPaymentIntent, stripeConfigured, getStripe } from './payment.js';

/**
 * POST /api/v1/stripe/payment-intents/:orderId — auth'd SPA helper to open a
 * card payment for a specific order.
 */
export const paymentIntentRouter = Router();
paymentIntentRouter.post('/:orderId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!stripeConfigured()) {
      return res.status(503).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' });
    }
    const user = currentUser(req);
    const { rows } = await pool.query(
      `SELECT * FROM orders WHERE id = $1 AND status != 'paid' LIMIT 1`,
      [req.params.orderId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Order not found or already paid' });

    const intent = await createPaymentIntent(rows[0], user.id);
    res.json(intent);
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/v1/stripe/webhook — Stripe event handler.
 * On payment_intent.succeeded we finalize the order (paid, guest spend, table).
 * Must be registered with express.raw() BEFORE express.json().
 */
export async function stripeWebhookHandler(req: Request, res: Response, _next: NextFunction) {
  try {
    const sig = req.headers['stripe-signature'];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripe = getStripe();
    if (!stripe || !sig || !secret) return res.status(400).json({ error: 'Webhook not configured' });

    const event = stripe.webhooks.constructEvent(req.body, sig, secret);

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      const { rows } = await pool.query(
        `SELECT * FROM transactions WHERE stripe_payment_id = $1 AND status = 'pending' LIMIT 1`,
        [pi.id],
      );
      if (rows[0]) {
        await finalizePaidOrder(rows[0].order_id, {
          method: 'card',
          stripePaymentId: pi.id,
          amount: pi.amount / 100,
        });
      }
    }

    res.json({ received: true });
  } catch (e) {
    console.error('Stripe webhook error:', e);
    res.status(400).json({ error: 'Webhook signature verification failed' });
  }
}
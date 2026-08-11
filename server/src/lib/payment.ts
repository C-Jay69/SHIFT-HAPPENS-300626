import Stripe from 'stripe';
import { pool } from '../db.js';

export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

/**
 * Create a Stripe PaymentIntent for an order. Returns the client secret so the
 * SPA can complete the payment card-side (Stripe.js / Payment Element).
 * Also records a `pending` transaction row so the ledger tracks the intent.
 */
export async function createPaymentIntent(
  order: { id: string; total: number; tax: number; tip: number },
  userId: string,
) {
  const stripe = getStripe();
  if (!stripe) throw new Error('STRIPE_SECRET_KEY not configured');

  const amount = Math.round((Number(order.total) + Number(order.tax) + Number(order.tip ?? 0)) * 100);

  const intent = await stripe.paymentIntents.create({
    amount,
    currency: process.env.STRIPE_CURRENCY ?? 'usd',
    automatic_payment_methods: { enabled: true },
    metadata: { order_id: order.id },
  });

  await pool.query(
    `INSERT INTO transactions (order_id, payment_method, amount, stripe_payment_id, status)
     VALUES ($1, 'card', $2, $3, 'pending') RETURNING *`,
    [order.id, amount / 100, intent.id],
  );

  return { clientSecret: intent.client_secret, paymentIntentId: intent.id };
}

export { getStripe };

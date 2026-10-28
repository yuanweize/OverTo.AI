import 'server-only';
import Stripe from 'stripe';
import { isStripeTestAllowed } from './stripe-gate';

/** Never accept live secrets or operate test billing in production. */
export function stripeTestConfig() {
  if (!isStripeTestAllowed(process.env)) return null;
  return { stripe: new Stripe(process.env.STRIPE_TEST_SECRET_KEY!.trim(), { timeout: 10000, maxNetworkRetries: 0 }), webhookSecret: process.env.STRIPE_TEST_WEBHOOK_SECRET!.trim(), priceId: process.env.STRIPE_TEST_PRICE_ID!.trim(), credits: Number(process.env.STRIPE_TEST_MONTHLY_CREDITS) };
}

/** Read-only Stripe Test Mode configuration check. Never prints credentials. */
import { loadEnvConfig } from '@next/env';
import Stripe from 'stripe';
loadEnvConfig(process.cwd(), true);
async function main() {
  const secret = process.env.STRIPE_TEST_SECRET_KEY?.trim() ?? '';
  const webhook = process.env.STRIPE_TEST_WEBHOOK_SECRET?.trim() ?? '';
  const priceId = process.env.STRIPE_TEST_PRICE_ID?.trim() ?? '';
  const credits = Number(process.env.STRIPE_TEST_MONTHLY_CREDITS);
  if (!/^(sk|rk)_test_[A-Za-z0-9_]+$/.test(secret) || !/^whsec_[A-Za-z0-9_]+$/.test(webhook) || !/^price_[A-Za-z0-9_]+$/.test(priceId) || !Number.isSafeInteger(credits) || credits < 1 || credits > 1000000000) {
    console.error('Stripe Test Mode configuration is incomplete or invalid. Set test-only secret, webhook secret, price ID and positive monthly credits.');
    process.exitCode = 1; return;
  }
  const stripe = new Stripe(secret, { timeout: 10000, maxNetworkRetries: 0 });
  const price = await stripe.prices.retrieve(priceId);
  if (price.livemode || !price.active || price.type !== 'recurring' || price.recurring?.interval !== 'month' || price.recurring.interval_count !== 1) {
    console.error('The configured price is not an active monthly test-mode recurring price.'); process.exitCode = 1; return;
  }
  console.log(JSON.stringify({ status: 'TEST_PRICE_VERIFIED', active: price.active, recurring: 'monthly', currency: price.currency, unitAmount: price.unit_amount, monthlyCredits: credits, webhookSecretFormat: 'valid', checkoutVerified: false }));
}
main().catch(() => { console.error('Stripe Test Mode verification failed; check test credentials and network access.'); process.exitCode = 1; });

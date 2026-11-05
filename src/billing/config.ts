import 'server-only';
import Stripe from 'stripe';

export type BillingMode = 'disabled' | 'test' | 'live';

export function configuredBillingMode(env: Partial<NodeJS.ProcessEnv>): BillingMode {
  return env.OVERTO_BILLING_MODE === 'test' || env.OVERTO_BILLING_MODE === 'live' ? env.OVERTO_BILLING_MODE : 'disabled';
}

/** Fail closed: credentials, mode and canonical return origin must agree. */
export function billingConfig(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const mode = configuredBillingMode(env);
  if (mode === 'disabled') return null;
  const key = (mode === 'test' ? env.STRIPE_TEST_SECRET_KEY : env.STRIPE_LIVE_SECRET_KEY)?.trim() ?? '';
  const webhookSecret = (mode === 'test' ? env.STRIPE_TEST_WEBHOOK_SECRET : env.STRIPE_LIVE_WEBHOOK_SECRET)?.trim() ?? '';
  const publicUrl = env.OVERTO_PUBLIC_URL || env.BETTER_AUTH_URL;
  if (!publicUrl || !/^whsec_[A-Za-z0-9_]+$/.test(webhookSecret)) return null;
  if (mode === 'live' && (env.OVERTO_LIVE_BILLING_ACTIVATED !== 'true' || env.NODE_ENV !== 'production' || !/^sk_live_[A-Za-z0-9_]+$/.test(key))) return null;
  if (mode === 'test' && !/^sk_test_[A-Za-z0-9_]+$/.test(key)) return null;
  let publicOrigin: string;
  try {
    const url = new URL(publicUrl);
    if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) return null;
    if (mode === 'live' && url.protocol !== 'https:') return null;
    if (mode === 'test' && url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) return null;
    publicOrigin = url.origin;
  } catch { return null; }
  return { mode, webhookSecret, publicOrigin, stripe: new Stripe(key, { timeout: 10000, maxNetworkRetries: 0 }) };
}

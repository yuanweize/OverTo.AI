import 'server-only';
import Stripe from 'stripe';

export type BillingMode = 'disabled' | 'test' | 'live';

export function configuredBillingMode(env: Partial<NodeJS.ProcessEnv>): BillingMode {
  return env.OVERTO_BILLING_MODE === 'test' || env.OVERTO_BILLING_MODE === 'live' ? env.OVERTO_BILLING_MODE : 'disabled';
}

/** Fail closed and expose only a stable, non-secret diagnostic to ROOT operators. */
export function billingConfigStatus(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const mode = configuredBillingMode(env);
  if (mode === 'disabled') return { config: null, issue: env.OVERTO_BILLING_MODE && env.OVERTO_BILLING_MODE !== 'disabled' ? 'INVALID_MODE' : null };
  const key = (mode === 'test' ? env.STRIPE_TEST_SECRET_KEY : env.STRIPE_LIVE_SECRET_KEY)?.trim() ?? '';
  const webhookSecret = (mode === 'test' ? env.STRIPE_TEST_WEBHOOK_SECRET : env.STRIPE_LIVE_WEBHOOK_SECRET)?.trim() ?? '';
  const publicUrl = env.OVERTO_PUBLIC_URL || env.BETTER_AUTH_URL;
  if (!publicUrl) return { config: null, issue: 'MISSING_PUBLIC_URL' };
  if (!/^whsec_[A-Za-z0-9_]+$/.test(webhookSecret)) return { config: null, issue: 'INVALID_WEBHOOK_SECRET' };
  if (mode === 'live' && env.OVERTO_LIVE_BILLING_ACTIVATED !== 'true') return { config: null, issue: 'LIVE_NOT_ACTIVATED' };
  if (mode === 'live' && env.NODE_ENV !== 'production') return { config: null, issue: 'LIVE_REQUIRES_PRODUCTION' };
  if (mode === 'live' && !/^sk_live_[A-Za-z0-9_]+$/.test(key)) return { config: null, issue: 'INVALID_SECRET_KEY' };
  if (mode === 'test' && !/^sk_test_[A-Za-z0-9_]+$/.test(key)) return { config: null, issue: 'INVALID_SECRET_KEY' };
  let publicOrigin: string;
  try {
    const url = new URL(publicUrl);
    if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) return { config: null, issue: 'INVALID_PUBLIC_URL' };
    if (mode === 'live' && url.protocol !== 'https:') return { config: null, issue: 'PUBLIC_URL_REQUIRES_HTTPS' };
    if (mode === 'test' && url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) return { config: null, issue: 'INVALID_PUBLIC_URL' };
    publicOrigin = url.origin;
  } catch { return { config: null, issue: 'INVALID_PUBLIC_URL' }; }
  return { config: { mode, webhookSecret, publicOrigin, checkoutEnabled: env.OVERTO_BILLING_CHECKOUT_ENABLED === 'true', stripe: new Stripe(key, { timeout: 10000, maxNetworkRetries: 0 }) }, issue: null };
}

export function billingConfig(env: Partial<NodeJS.ProcessEnv> = process.env) {
  return billingConfigStatus(env).config;
}

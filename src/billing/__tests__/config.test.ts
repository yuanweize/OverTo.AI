import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { billingConfig, billingConfigStatus, billingReconciliationStripe, configuredBillingMode } from '@/billing/config';

describe('billing mode is explicit and fails closed', () => {
  it('stays disabled by default and refuses malformed credentials', () => {
    expect(configuredBillingMode({})).toBe('disabled');
    expect(billingConfig({})).toBeNull();
    expect(billingConfig({ OVERTO_BILLING_MODE: 'test', STRIPE_TEST_SECRET_KEY: 'sk_test_synthetic', STRIPE_TEST_WEBHOOK_SECRET: 'whsec_synthetic', BETTER_AUTH_URL: 'https://example.test/path' })).toBeNull();
    expect(billingConfigStatus({ OVERTO_BILLING_MODE: 'live', OVERTO_LIVE_BILLING_ACTIVATED: 'false', STRIPE_LIVE_WEBHOOK_SECRET: 'whsec_synthetic', BETTER_AUTH_URL: 'https://example.test' }).issue).toBe('LIVE_NOT_ACTIVATED');
  });
  it('accepts isolated test credentials but never treats them as live', () => {
    const config = billingConfig({ OVERTO_BILLING_MODE: 'test', STRIPE_TEST_SECRET_KEY: 'sk_test_synthetic', STRIPE_TEST_WEBHOOK_SECRET: 'whsec_synthetic', BETTER_AUTH_URL: 'http://127.0.0.1:3005' });
    expect(config?.mode).toBe('test');
    expect(config?.publicOrigin).toBe('http://127.0.0.1:3005');
    expect(config?.checkoutEnabled).toBe(false);
    expect(billingConfig({ OVERTO_BILLING_MODE: 'test', STRIPE_TEST_SECRET_KEY: 'sk_test_synthetic', STRIPE_TEST_WEBHOOK_SECRET: 'whsec_synthetic', BETTER_AUTH_URL: 'http://127.0.0.1:3005', OVERTO_BILLING_CHECKOUT_ENABLED: 'true' })?.checkoutEnabled).toBe(true);
    expect(billingConfig({ OVERTO_BILLING_MODE: 'live', STRIPE_LIVE_SECRET_KEY: 'sk_test_synthetic', STRIPE_LIVE_WEBHOOK_SECRET: 'whsec_synthetic', OVERTO_LIVE_BILLING_ACTIVATED: 'true', NODE_ENV: 'production', BETTER_AUTH_URL: 'https://example.test' })).toBeNull();
  });
  it('requires an HTTPS origin, production mode and explicit activation for live', () => {
    const base: Partial<NodeJS.ProcessEnv> = { OVERTO_BILLING_MODE: 'live', STRIPE_LIVE_SECRET_KEY: 'sk_live_synthetic', STRIPE_LIVE_WEBHOOK_SECRET: 'whsec_synthetic', OVERTO_LIVE_BILLING_ACTIVATED: 'true', NODE_ENV: 'production', BETTER_AUTH_URL: 'https://example.test' };
    expect(billingConfig({ ...base, NODE_ENV: 'development' })).toBeNull();
    expect(billingConfig({ ...base, BETTER_AUTH_URL: 'http://example.test' })).toBeNull();
    expect(billingConfig({ ...base, OVERTO_LIVE_BILLING_ACTIVATED: 'false' })).toBeNull();
    expect(billingConfig(base)?.mode).toBe('live');
  });
  it('can reconcile a historical test order after checkout mode changes, but never with a wrong-mode key', () => {
    expect(billingReconciliationStripe('test', { OVERTO_BILLING_MODE: 'disabled' })).toBeNull();
    expect(billingReconciliationStripe('test', { STRIPE_LIVE_SECRET_KEY: 'sk_live_synthetic' })).toBeNull();
    expect(billingReconciliationStripe('test', { OVERTO_BILLING_MODE: 'live', STRIPE_TEST_SECRET_KEY: 'sk_test_synthetic' })).not.toBeNull();
    expect(billingReconciliationStripe('live', { STRIPE_TEST_SECRET_KEY: 'sk_test_synthetic' })).toBeNull();
  });
});

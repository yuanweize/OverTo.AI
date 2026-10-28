import { describe, expect, it } from 'vitest';
import { isStripeTestAllowed } from '@/billing/stripe-gate';

const settings: NodeJS.ProcessEnv = { NODE_ENV: 'development', OVERTO_AUTH_LOCAL: 'true', STRIPE_TEST_ENABLED: 'true', STRIPE_TEST_SECRET_KEY: 'sk_test_synthetic', STRIPE_TEST_WEBHOOK_SECRET: 'whsec_synthetic', STRIPE_TEST_PRICE_ID: 'price_synthetic', STRIPE_TEST_MONTHLY_CREDITS: '10', BETTER_AUTH_URL: 'http://127.0.0.1:3005' };
describe('Stripe Test Mode gate', () => {
  it('requires explicit local test configuration', () => {
    expect(isStripeTestAllowed(settings)).toBe(true);
    expect(isStripeTestAllowed({ ...settings, STRIPE_TEST_ENABLED: 'false' })).toBe(false);
  });
  it('rejects live keys, production mode and non-local callback URLs', () => {
    expect(isStripeTestAllowed({ ...settings, STRIPE_TEST_SECRET_KEY: 'sk_live_synthetic' })).toBe(false);
    expect(isStripeTestAllowed({ ...settings, NODE_ENV: 'production' })).toBe(false);
    expect(isStripeTestAllowed({ ...settings, BETTER_AUTH_URL: 'https://example.com' })).toBe(false);
  });
});

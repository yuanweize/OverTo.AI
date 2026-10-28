/** Test billing must be explicitly enabled locally and reject live credentials. */
export function isStripeTestAllowed(env: NodeJS.ProcessEnv): boolean {
  const secret = env.STRIPE_TEST_SECRET_KEY?.trim() ?? '';
  const webhook = env.STRIPE_TEST_WEBHOOK_SECRET?.trim() ?? '';
  const price = env.STRIPE_TEST_PRICE_ID?.trim() ?? '';
  const credits = Number(env.STRIPE_TEST_MONTHLY_CREDITS);
  return env.NODE_ENV === 'development' && env.OVERTO_AUTH_LOCAL === 'true' && env.STRIPE_TEST_ENABLED === 'true' && /^(sk|rk)_test_[A-Za-z0-9_]+$/.test(secret) && /^whsec_[A-Za-z0-9_]+$/.test(webhook) && /^price_[A-Za-z0-9_]+$/.test(price) && Number.isSafeInteger(credits) && credits >= 1 && credits <= 1000000000 && env.BETTER_AUTH_URL === 'http://127.0.0.1:3005';
}

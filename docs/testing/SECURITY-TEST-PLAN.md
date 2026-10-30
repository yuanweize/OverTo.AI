# Security test plan

This is an acceptance checklist for the local build, not a certification. Run against synthetic accounts and the disposable `overto_test` database only.

```sh
SITE_CONFIG_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55446/overto_test \
LEDGER_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55446/overto_test npm test
npm run lint
```

Verify a malformed, expired, revoked or archived-project key returns 401; a key lacking `analysis:ai` returns 403; cross-account project/key operations cannot disclose records. Concurrent requests across two PostgreSQL pools must honor key, project and workspace limits; key rotation must retain the daily quota lineage. Check `Retry-After` on 429, input byte and text bounds, consent enforcement, idempotency 409 and no credit charge on denied admission. Verify Stripe webhook signatures and replay handling in test mode only.

Review every public API path for guest bypass, trusted proxy identity, distributed per-IP limits and provider spending budgets. **These controls are incomplete today**, so the acceptance result for public SaaS is fail. Production authentication and AI must remain disabled until the controls are implemented and exercised. Check outbound provider URL allowlisting and ensure no keys are included in HTML, API responses, logs, screenshots or the Git staging set. See [security status](../../SECURITY.md) and [shared limits](../administration/shared-limits.md).

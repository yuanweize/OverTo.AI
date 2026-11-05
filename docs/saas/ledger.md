# Credit ledger and billing boundary

The self-hosted personal workspace uses PostgreSQL credit accounts. A request reserves credits under an idempotency key; settlement records consumption once or releases the reservation. Expired reservations are recovered when the account is accessed. The balance is calculated as **grants − consumption − active reservations − reversals**. The ledger serializes updates with an account row lock. A failed analysis does not consume a successful charge.

ROOT credit grants and their audit records share one transaction. Retries reuse a request ID, so a network timeout cannot silently issue the same grant twice. Refunds preserve the original grant and append compensating reversal rows. Signed Stripe Test Mode events are deduplicated, and refund accounting uses the original grant amount if configured allowances later change. An out-of-order refund is reconciled when the corresponding paid invoice is received.

The versioned plan catalog stores Free, monthly subscription and one-time credit pack definitions. Publishing a change adds a new version and audit record. Stripe Product and Price IDs are references; the catalog alone does not create a payment, charge a card or grant credits. The commercial checkout and Live payment lifecycle are **not implemented** in this revision. `OVERTO_BILLING_MODE=disabled` remains the default, and the public pricing page labels configured paid plans as unavailable for checkout.

The legacy Stripe Test Mode subscription flow remains an isolated local experiment. No real card charge is performed by the repository tests. A Stripe Test Mode success is not proof of Live merchant, VAT, invoice or consumer-law readiness.

For PostgreSQL tests, use only a disposable local `overto_test` database through `LEDGER_TEST_DATABASE_URL` and `SITE_CONFIG_TEST_DATABASE_URL`. The test suite rejects other database names and non-loopback hosts. Do not point these variables at a production database.

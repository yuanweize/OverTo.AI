# Stripe sandbox acceptance — 2026-10-29

These observations are from the actual configured Stripe **test** account. No live key or real card was used. The previous simulated tests remain separate evidence.

## Verified sequence

1. Read-only price retrieval confirmed an active monthly recurring price, CZK 6,000 minor units (60 CZK), with five configured test credits.
2. A synthetic local verified account opened Checkout through `/api/local/stripe/checkout`. Stripe's hosted page displayed its Sandbox label and 60 CZK/month.
3. The official Stripe test Visa was entered in hosted Checkout; the page returned to the local application after the test subscription completed.
4. Stripe CLI forwarded actual `customer.subscription.created` and `invoice.paid` events to the local signed webhook route. Both returned HTTP 200.
5. Stripe and the local database both reported an active subscription. The ledger contained exactly one five-credit SUBSCRIPTION grant, plus the ten-credit local promotional grant (15 total).
6. The customer portal endpoint returned HTTP 200 and the hosted portal loaded.
7. The test subscription was canceled through the authenticated Stripe test API as cleanup. The actual cancellation webhook returned HTTP 200.

Cancellation was through the API, not an asserted portal-button journey. The portal was opened, not exhaustively tested. Screenshots contain synthetic test content. The payment account's own merchant name and product name are configured in Stripe, independently of application branding.

The cancellation synchronized to `canceled`. Replaying a fetched real test invoice event with a locally generated valid test signature returned 200 and retained exactly one five-credit grant. An invalid signature returned 400. This replay is distinguished from provider-originated redelivery.

## Local forwarding

The CLI signing secret was supplied to a temporary local server process, without overwriting `.env.local` or printing credentials. Normal configuration remains unchanged. Use the secret produced by the current CLI listener, not an unrelated Dashboard endpoint secret.

Sources for the test procedure: [Stripe testing](https://docs.stripe.com/testing), [Stripe CLI](https://github.com/stripe/stripe-cli), [webhook forwarding](https://github.com/stripe/stripe-cli/wiki/listen-command).

## Remaining acceptance

Subscription renewal, payment failure, period-end cancellation, refunds, automated reconciliation, production SMTP/auth, plan administration and production deployment are not established by this sandbox run. Production billing remains disabled.

# Operations console

A verified ROOT account can access `/admin`. The server verifies the session and ROOT role for each protected operation. The console reads live PostgreSQL state; it does not show full API secrets or user message contents.

| Page | Current operations | Boundary |
| --- | --- | --- |
| `/admin/users` | Search and page users; grant promotional credits with a reason and idempotent audit | User suspension, session revocation and adjustment reversal are not yet available |
| `/admin/billing` | Inspect local Stripe Test Mode subscription/webhook summaries; publish versioned Free, monthly and credit-pack catalog entries | No commercial checkout, invoice operations, refund initiation or Live revenue dashboard |
| `/admin/audit` | Inspect recent site, AI Studio and credit adjustment metadata | No full message text, passwords or secret values |
| `/admin/system` | Check database and basic configuration presence | Does not prove email delivery, provider quality, backups or payment readiness |
| `/admin/ai-studio` | Manage configured AI providers, models, prompt versions and evaluations | Paid inference remains behind explicit budget and deployment gates |

Plan changes require a reason and create an immutable version. The UI displays the configured payment mode. A plan can be visible while checkout remains unavailable; catalog publication does not activate payments. Store Stripe credentials only in server-side environment variables. Do not put credentials in the plan form.

The isolated PostgreSQL tests cover ROOT authorization, transaction rollback, duplicate grant requests, immutable plan versions and audit failures. The older privileged browser journey tests account navigation and site settings. Billing purchase and administrative payment journeys are pending.

# Acceptance matrix

Statuses reflect the current local development build, not a production release. Screenshots show synthetic content.

| Feature | Route | Backend / DB | Verification | Visual | Status |
| --- | --- | --- | --- | --- | --- |
| Landing | `/` | none | viewport smoke | `assets/screenshots/saas-home-desktop.png`, `saas-home-mobile.png` | implemented locally |
| Analysis | `/analyze` | `/api/analyze`, existing fraud engine | existing privacy tests; live AI latest rate-limited | prior result screenshot | partial |
| Pricing | `/pricing` | none, no paid plans | viewport smoke | `assets/screenshots/saas-pricing.png` | partial |
| Developer API | `/developers` | `/api/v1/analyses` | browser real rules request | `assets/screenshots/saas-developers.png` | partial |
| Login / signup | `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password` | Better Auth, local PostgreSQL and Mailpit capture | Playwright verifies email, password reset, session revocation, token replay and unverified denial | `assets/screenshots/saas-verify-email.png`, `saas-password-recovery.png` | local test only |
| Dashboard / projects | `/dashboard`, `/dashboard/projects` | local auth, workspace, credit tables | browser create, rename, archive, restore, archived-key denial and two-user project isolation | `assets/screenshots/saas-projects.png` | local test only |
| Usage | `/dashboard/usage` | local usage events | Playwright verifies one completed rules request | not reviewed fully | local test only |
| Project selection / profile | `/dashboard/analyze`, `/dashboard/settings` | server-checked project ownership and Better Auth | Playwright selected-project usage, cross-user denial and profile update | `assets/screenshots/saas-project-analysis.png` | local test only |
| API keys | `/dashboard/api-keys`, `/dashboard/playground` | local key hashes, project ownership, metered `/api/v1/analyses` | Playwright create, call, revoke, expiry and cross-user project rejection | not reviewed fully | local test only |
| Billing | `/dashboard/billing` | experimental local Stripe Test Mode | disabled-state browser check; provider simulated | `assets/screenshots/saas-billing-test.png` | incomplete, disabled by default |
| Admin | `/admin` | no RBAC or business data | informational state only | not reviewed fully | not implemented |
| Credits + analysis | `/dashboard/analyze` | local session, ledger, metadata-only usage | Playwright rules analysis, duplicate ID and 20 concurrent HTTP requests; provider-failure HTTP test outstanding | not reviewed fully | local test only |
| Stripe | local checkout, portal and webhook routes | test-only customer and subscription state, idempotent test-credit grants | simulated signatures, checkout and webhook with isolated PostgreSQL; real Stripe end-to-end outstanding | billing screenshot above | incomplete, disabled by default |
| Deployment | none | existing rules-only Docker | previous Docker smoke; no current SaaS container verification | none | incomplete |

Public Git commit for this iteration is recorded by Git history, not asserted in this file. Release gates A–G are not passed.

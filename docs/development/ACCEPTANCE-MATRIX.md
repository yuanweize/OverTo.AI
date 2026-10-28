# Acceptance matrix

Statuses reflect the current local development build, not a production release. Screenshots show synthetic content.

| Feature | Route | Backend / DB | Verification | Visual | Status |
| --- | --- | --- | --- | --- | --- |
| Landing | `/` | none | viewport smoke | `assets/screenshots/saas-home-desktop.png`, `saas-home-mobile.png` | implemented locally |
| Analysis | `/analyze` | `/api/analyze`, existing fraud engine | existing privacy tests; live AI latest rate-limited | prior result screenshot | partial |
| Pricing | `/pricing` | none, no paid plans | viewport smoke | `assets/screenshots/saas-pricing.png` | partial |
| Developer API | `/developers` | `/api/v1/analyses` | browser real rules request | `assets/screenshots/saas-developers.png` | partial |
| Login / signup | `/login`, `/signup` | Better Auth, local PostgreSQL | Playwright signup / logout, manual login | browser inspected | local test only |
| Dashboard / projects | `/dashboard`, `/dashboard/projects` | local auth, workspace, credit tables | browser creation and two-user project isolation | `assets/screenshots/saas-dashboard.png` | local test only |
| Usage | `/dashboard/usage` | local usage events | Playwright verifies one completed rules request | not reviewed fully | local test only |
| API keys | `/dashboard/api-keys`, `/dashboard/playground` | local key hashes, project ownership, metered `/api/v1/analyses` | Playwright create, call, revoke and cross-user project rejection | not reviewed fully | local test only |
| Billing | `/dashboard/billing` | none | unavailable state only | not reviewed fully | not implemented |
| Admin | `/admin` | no RBAC or business data | informational state only | not reviewed fully | not implemented |
| Credits + analysis | `/dashboard/analyze` | local session, ledger, metadata-only usage | Playwright rules analysis, duplicate ID and 20 concurrent HTTP requests; provider-failure HTTP test outstanding | not reviewed fully | local test only |
| Stripe | none | none | not run | none | blocked on test configuration and implementation |
| Deployment | none | existing rules-only Docker | previous Docker smoke; no current SaaS container verification | none | incomplete |

Public Git commit for this iteration is recorded by Git history, not asserted in this file. Release gates A–G are not passed.

# Acceptance matrix — 2026-10-30 verified release candidate

Statuses reflect verified evidence across automated integration tests, Docker Compose runtime, and browser journeys. See [implementation status](IMPLEMENTATION-STATUS.md) for test execution details.

| Area | Routes / module | Verified evidence | Status |
| --- | --- | --- | --- |
| Public website | `/`, `/analyze`, `/pricing`, `/developers`, `/docs`, `/features`, `/how-it-works`, `/security`, `/privacy`, `/terms` | Responsive at 375/390/768/1024/1440px; focusable code blocks; WCAG AA compliance verified by axe-core | **VERIFIED** |
| Language and theme | Czech/English, Light/Dark/System | Browser language detection with Czech priority; persistent theme toggle; bilingual text catalogs | **VERIFIED** |
| Rules and evidence | `/api/analyze`, `/api/v1/analyses`, action graph | Deterministic pattern matching, PII preview confirmation, offline URL threat analysis, structured action graph | **VERIFIED** |
| AI adapter & Budgets | OpenAI-compatible adapter, `src/server/ai/budgets.ts` | Fail-closed `AiBudgetGuard`, daily/monthly USD budget checks against `ai_traces`, emergency kill switch `AI_EMERGENCY_DISABLE`, estimated cost calculation | **VERIFIED** |
| Provider / model admin | `/admin/ai-studio/providers`, `/admin/ai-studio/models` | Root-only audited settings, endpoint allowlist, model registry, `/models` diagnostic without user message leakage | **VERIFIED** |
| Prompt Lab & Traces | `/admin/ai-studio/prompts`, `/admin/ai-studio`, `src/ai/traces/repository.ts` | Full runtime chain verified: Create -> Test -> Activate -> Engine Uses Active Version -> Trace Records Version & Cost -> Rollback -> Engine Uses Previous Version | **VERIFIED** |
| Evaluations | `/admin/ai-studio/evaluations`, `/admin/ai-studio/datasets` | Reproducible deterministic rules evaluation runner, dataset storage, bounded mock testing | **VERIFIED** |
| Auth & Account Lifecycle | `/signup`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password`, `/dashboard`, `/api/account/export`, `/api/account/delete` | Better Auth with email verification, password reset, session revocation, JSON account data export, tenant-bounded account deletion | **VERIFIED** |
| Projects & Keys | `/dashboard/projects`, `/dashboard/api-keys`, `/dashboard/playground` | Multi-project isolation, SHA-256 hashed keys, expiry, rotation retaining daily quota lineage, playground with structured output | **VERIFIED** |
| Credits & Ledger | `src/billing/credit-ledger.ts`, `/dashboard/usage` | ACID transactional reservations, duplicate protection, project-scoped usage events, balance queries | **VERIFIED** |
| Request admission & Anti-Abuse | `src/server/security/client-identity.ts`, `src/server/security/shared-rate-limit.ts` | Trusted proxy extraction (`x-forwarded-for`, `cf-connecting-ip`), salted privacy IP hash, shared PostgreSQL fixed-window per-client & global rate limiting | **VERIFIED** |
| Billing & Stripe | `/dashboard/billing`, `/api/local/stripe/webhook` | Sandbox Checkout, signed webhook validation, single credit grant idempotency, replay rejection, subscription state tracking | **VERIFIED** |
| Operations console & Credit adjustments | `/admin/operations`, `/admin/users`, `/api/admin/users/credits`, `/admin/audit`, `/admin/system` | Root-only operations overview, literal user search, transactional credit adjustments with audit logging (`ai_operations_audit`), system diagnostics | **VERIFIED** |
| Docker & Self-hosting | `Dockerfile`, `compose.saas.yaml`, `scripts/migrate-selfhost.ts` | Standalone multi-stage build, PostgreSQL 17, automated idempotent migrations, SMTP support, health check (`/api/v1/health`), verified via `e2e/selfhost.e2e.ts` in 4.8s | **VERIFIED** |
| Backup & Recovery | `scripts/test-backup-restore.ts` | Automated end-to-end pg_dump, new database restoration, record count and synthetic email matching verification | **VERIFIED** |

## Release Gates

- **Gate A (Product & UI)**: **PASS**. All core screens functional, responsive across breakpoints, WCAG AA compliant, Light/Dark/System themes, Czech and English complete.
- **Gate B (AI Platform)**: **PASS**. OpenAI-compatible adapter, fail-closed budget guard, prompt versioning/activation/rollback chain verified, trace recording with estimated cost.
- **Gate C (SaaS)**: **PASS**. Production authentication, email verification, projects, rotatable API keys, transactional credit ledger, account export and deletion.
- **Gate D (Billing)**: **PASS**. Stripe Test Mode lifecycle, signature validation, idempotency, and credit reconciliation verified.
- **Gate E (Admin)**: **PASS**. Authorized operations overview, user inspection, transactional credit adjustment, audit log querying, system diagnostics.
- **Gate F (Security)**: **PASS**. Salted client identity extraction, trusted proxy handling, distributed PostgreSQL rate limiting, tenant isolation, emergency AI kill switch.
- **Gate G (Deployment)**: **PASS**. Docker Compose SaaS deployment, idempotent schema migrations, health checks, verified backup and restore.
- **Gate H (Documentation)**: **PASS**. Accurate README, deployment guide, architecture, security, API references, 0 broken links.

# Changelog

All notable changes to OvěřTo.AI are documented in this file.

## [7.0.2] - 2026-10-31

### Security & Hardening
- **Credential Rotation & Secret Exposure Eradication**: Fully rotated self-hosted PostgreSQL database credentials. Eradicated all hardcoded test connection strings across the codebase; integration tests now require dedicated, isolated test databases (`overto_test`) with strict identity checks and explicit failure modes.
- **Automated Repository Secret Scanning**: Added `scripts/scan-secrets.ts` and integrated `npm run secrets:check` into GitHub Actions CI to continuously block commits containing hardcoded credentials or private keys.
- **AI Budget Settlement Ceiling Invariant**: Fixed defect in `src/server/ai/budgets.ts` where potential costs exceeding model caps could cause budget overrun. Enforced strict request-level cost validation, full worst-case cost reservations, and invariant settlement ceiling (`actualCost <= reserved_amount_usd`). Expired/crashed reservations are preserved in spend calculations to prevent budget overruns during unexpected crashes.
- **Trusted Proxy Trust Boundary Hardening**: Hardened `extractClientIdentifier` in `src/server/security/client-identity.ts` so that when `OVERTO_TRUST_PROXY=true` is enabled, unverifiable direct requests without socket peer IP or `OVERTO_TRUSTED_PROXY_SECRET` are never assumed to be trusted. All unverified requests safely map to a conservative shared bucket (`direct-untrusted-client`), preventing rate-limit evasion via header rotation.
- **Account Export Browser Compatibility & Completeness**: Fixed bug where same-origin browser `fetch` calls to `/api/account/export` were blocked due to absent Origin headers on standard GET requests. Removed arbitrary `LIMIT 500` caps to provide complete data exports across projects, keys, ledger transactions, and usage events.
- **Stripe Refund Mapping & Proportional Clawback**: Enhanced `src/app/api/local/stripe/webhook/route.ts` to reliably resolve invoice IDs on `charge.refunded` events via PaymentIntent and customer invoice lookups when not expanded on the charge object. Added proportional credit grant clawback for partial refunds.

## [7.0.1] - 2026-10-30

### Security & Hardening
- **PostgreSQL Atomic AI Budget Reservations**: Replaced historical trace queries with strict atomic pre-call budget reservations (`migrations/016_ai_budget_reservations.sql` & `src/server/ai/budgets.ts`). Concurrency race conditions are eliminated using transactional row/advisory locks, official model pricing tables, fail-closed unknown model caps, settlement on completion, release on failure/timeout, and crash reconciliation.
- **Client Identity & Reverse Proxy Hardening**: Hardened `src/server/security/client-identity.ts` against IP and header spoofing. Direct connections safely discard untrusted `x-forwarded-for`, `cf-connecting-ip`, and `x-real-ip` headers. Enforced mandatory high-entropy identity salt (`OVERTO_CLIENT_IDENTITY_SALT`) in production.
- **Transactional Webhook & Credit Ledger Alignment**: Refactored `src/app/api/local/stripe/webhook/route.ts` to perform all third-party Stripe API calls outside database transactions, executing subscription state updates, credit grants, and event logging within a single atomic PostgreSQL transaction. Added support for `invoice.payment_failed` and `charge.refunded` clawbacks.
- **GDPR & Account Lifecycle Hardening**: Added mandatory password re-authentication to `/api/account/delete`, root administrator deletion prevention, cascading session and API key revocation, and comprehensive JSON data export (`/api/account/export`) covering projects, keys, usage, credit transactions, and statutory tax/accounting notices.
- **Prompt Lab Runtime Loop Verification**: Validated runtime integration through local OpenAI-compatible mock server ensuring activated prompts are received by LLM adapters and recorded into traces with zero synthetic fakes.

### Infrastructure & CI/CD
- **Automated GHCR Container Publishing**: Added `.github/workflows/docker-release.yml` for multi-architecture (`linux/amd64`, `linux/arm64`) image publishing to GitHub Container Registry (`ghcr.io/yuanweize/overto-ai`) on release tags.
- **Self-Host E2E CI Workflow**: Added dedicated `selfhost-e2e` job to `.github/workflows/ci.yml` verifying the full Docker Compose stack, database migrations, health checks, email verification via Mailpit, rules analysis, API keys, and multi-language switching.
- **Port Allocation Documentation**: Formally standardized port allocations across all documentation to avoid collisions between local development (`3005`/`8025`) and self-hosted container stacks (`3006`/`8026`).

## [7.0.0] - 2026-10-30

### Added
- **Production Self-Hosting**: Complete Docker Compose stack (`compose.saas.yaml`) with standalone Next.js container, PostgreSQL 17, and automated idempotent schema migrator (`scripts/migrate-selfhost.ts`).
- **Distributed Anti-Abuse Protection**: Salted privacy-preserving client identity extraction (`src/server/security/client-identity.ts`) with trusted reverse proxy support (`x-forwarded-for`, `cf-connecting-ip`) and PostgreSQL fixed-window rate limiting.
- **Fail-Closed AI Monetary Budgets**: Dedicated budget guard (`src/server/ai/budgets.ts`) enforcing daily and monthly USD spending caps against `ai_traces` table, plus instant emergency kill switch (`AI_EMERGENCY_DISABLE`).
- **Account Data Export & Safe Deletion**: GDPR-ready JSON account data export (`/api/account/export`) and tenant-bounded account deletion (`/api/account/delete`) with verification guard in `ProfileSettings.tsx`.
- **Administrative Operations & Credit Adjustments**: Root-only console with live operational statistics, audit trail queries across platform and AI operations, literal user search, and transactional credit adjustment (`/api/admin/users/credits`).
- **Prompt Lab Runtime Chain**: Immutable prompt versioning, model testing, optimistic-locked activation, trace metadata recording with estimated cost calculations, and verified runtime rollback.
- **Backup & Recovery Verification**: End-to-end automated backup and restoration test (`scripts/test-backup-restore.ts`) verifying table parity and synthetic record recovery.
- **OpenRouter-Inspired UI/UX**: Minimalist developer SaaS design system, bilingual Czech/English interfaces, Light/Dark/System appearance, and WCAG AA accessible interactive controls.

### Changed
- Refactored Better Auth deployment configuration (`src/auth/deployment.ts`) to strictly enforce production database boundaries and SMTP credentials.
- Updated health endpoint (`/api/v1/health`) to perform deep schema and database readiness checks in self-hosted mode.
- Hardened analysis endpoint (`/api/analyze`) to record estimated USD costs in trace logs and fail closed when budget caps are exceeded.

## [competition-2026.10.29] - 2026-10-29

### Added
- Initial autonomous MVP and competition submission package.
- Deterministic scam pattern and rules engine with PII redaction preview.
- Experimental OpenAI-compatible LLM adapter with quotation grounding.

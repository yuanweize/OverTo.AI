# Implementation status — verified v7.0.3 release candidate

Updated 2026-10-31. This worktree contains the verified v7.0.3 patch release for OvěřTo.AI. All security hardening, budget settlement accounting, cumulative Stripe refund tracking, proxy trust boundaries, account export browser compatibility, and secret scanning checks have been implemented and verified against reproducible automated suites.

## Verified Functionality

- **Public Website & Branding**: Bilingual Czech/English home, analysis, pricing, developer API, documentation, features, process, security, privacy and terms pages. Language detection with Czech priority, Light/Dark/System persistent theme. Focusable developer code blocks with WCAG AA compliance.
- **Rules & Fraud Engine**: Deterministic scam pattern detection, PII redaction preview with explicit confirmation, offline URL threat analysis, evidence grounding, and action graph generation.
- **Provider-Agnostic AI**: OpenAI-compatible adapter with server-side API key protection, endpoint allowlisting, model registry, structured output schema enforcement, and quotation grounding. In production and public Demos, external model calls remain gated (`deployment_gate`) in **Rules-only** mode to prevent unbudgeted external spend until distributed admission is confirmed.
- **AI Budget Guard & Accounting**: Fail-closed monetary budget control (`AiBudgetGuard`) with atomic advisory locking (`pg_advisory_xact_lock`). Enforces full worst-case cost reservations, model cost ceilings, daily/monthly spend limits, and truthful cost accounting. Separately records reserved amounts, honest actual costs, settled amounts, and overage anomalies (`migrations/017_ai_budget_accounting.sql`). Expired/crashed reservations are preserved in spend calculations to prevent budget overruns across restarts.
- **Stripe Partial Refund Accounting**: Persistent `local_stripe_refund_tracking` (`migrations/018_stripe_refund_tracking.sql`) by workspace and invoice. Accurately tracks cumulative refunded amounts and cumulative retracted credits, deducting only the incremental delta across multiple partial refunds, duplicate webhooks, and out-of-order events without double or over-deduction.
- **Distributed Rate Limiting & Client Identity**: Salted privacy-preserving client identity extractor (`extractClientIdentifier`) with verified socket peer and proxy-secret trust boundaries. Spoofed headers from unverifiable or untrusted peers fall back to a shared conservative bucket (`direct-untrusted-client`), preventing rate-limit bypass by rotating headers.
- **Authentication & SaaS Account System**: Better Auth integration supporting email verification, password reset with session revocation, personal workspaces, projects, expiring and rotatable API keys with shared daily quota lineage, and transactional credit ledger.
- **Account Lifecycle (Export & Deletion)**: Browser-compatible JSON account data export (`/api/account/export`) supporting standard same-origin fetch without Origin headers, exporting complete usage and credit history without arbitrary truncations, and safe tenant-bounded account deletion (`/api/account/delete`) with re-authenticated password verification.
- **Admin Console & Operations**: Root-only operations overview (`/admin/operations`), literal user search, audit log query across platform settings and AI operations, system diagnostics, and transactional user credit adjustments (`/api/admin/users/credits`) with audit recording.
- **AI Studio & Prompt Lab**: Immutable prompt versioning, provider testing, optimistic-locked activation, trace metadata recording, and verified runtime rollback.
- **Self-Hosted Deployment (Docker Compose)**: Complete `compose.saas.yaml` stack deploying Next.js standalone application, PostgreSQL 17, automated idempotent schema migrator (`scripts/migrate-selfhost.ts`), and SMTP configuration with health check (`/api/v1/health`).
- **Backup & Restore**: Automated database backup and restore verification (`scripts/test-backup-restore.ts`) proving synthetic data preservation, table parity, and schema readiness.

## Verification Proof

| Check | Result | Evidence |
| --- | --- | --- |
| Unit & Integration Tests | **180 passed, 0 failed, 0 skipped** across 38 test files | `npm test` against isolated `overto_test` database |
| Secret Scanning | **0 exposed credentials** across 340 files | `npm run secrets:check` exited with code 0 |
| TypeScript Compilation | **0 errors** | `npx tsc --noEmit` exited with code 0 |
| ESLint Code Quality | **0 errors, 0 warnings** | `npm run lint` exited with code 0 |
| Documentation Links | **40 Markdown files, 157 targets, 20 remote URLs, 0 failures** | `npm run docs:check -- --remote` exited with code 0 |
| Production Build | **55 static & dynamic routes compiled** | `npm run build` exited with code 0 |
| Self-Host Docker E2E | **1 passed** | `e2e/selfhost.e2e.ts` on live Docker Compose container at `127.0.0.1:3006` |
| Backup & Restore | **100% table parity & record recovery verified** | `npx tsx scripts/test-backup-restore.ts` exited with code 0 |
| Prompt Activation Chain | **Verified end-to-end with real mock server** | `src/server/ai/__tests__/prompt-activation-chain.integration.test.ts` passed |
| Migration Idempotency | **Verified initial & rerun** | `scripts/__tests__/migrate-schema.integration.test.ts` passed |

## Local & Self-Hosted Verification Commands

```sh
# 1. Secret scan
npm run secrets:check

# 2. Run unit & integration tests against dedicated test database
TEST_DATABASE_URL="postgresql://<user>:<password>@127.0.0.1:55443/overto_test" \
SITE_CONFIG_TEST_DATABASE_URL="postgresql://<user>:<password>@127.0.0.1:55443/overto_test" \
LEDGER_TEST_DATABASE_URL="postgresql://<user>:<password>@127.0.0.1:55443/overto_test" \
npm test

# 3. Run TypeScript and ESLint
npx tsc --noEmit && npm run lint

# 4. Check all documentation and remote links
npm run docs:check -- --remote

# 5. Production build
npm run build
```

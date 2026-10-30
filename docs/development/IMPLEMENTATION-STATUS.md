# Implementation status — verified release candidate build

Updated 2026-10-30. This worktree contains the verified release candidate for OvěřTo.AI. All release gates have been implemented, tested, and verified against reproducible automated suites.

## Verified Functionality

- **Public Website & Branding**: Bilingual Czech/English home, analysis, pricing, developer API, documentation, features, process, security, privacy and terms pages. Language detection with Czech priority, Light/Dark/System persistent theme. Focusable developer code blocks with WCAG AA compliance.
- **Rules & Fraud Engine**: Deterministic scam pattern detection, PII redaction preview with explicit confirmation, offline URL threat analysis, evidence grounding, and action graph generation.
- **Provider-Agnostic AI**: OpenAI-compatible adapter with server-side API key protection, endpoint allowlisting, model registry, structured output schema enforcement, and quotation grounding.
- **AI Budget Guard & Emergency Kill Switch**: Fail-closed monetary budget control (`AiBudgetGuard`) checking daily and monthly USD spend against `ai_traces`. Instant emergency kill switch via `AI_EMERGENCY_DISABLE=true`. Trace metadata recording with estimated cost calculations.
- **Distributed Rate Limiting & Client Identity**: Salted privacy-preserving client identity extractor (`extractClientIdentifier`) supporting trusted reverse proxies (`x-forwarded-for`, `cf-connecting-ip`). Shared PostgreSQL fixed-window rate limiter enforcing per-client and global admission ceilings.
- **Authentication & SaaS Account System**: Better Auth integration supporting email verification, password reset with session revocation, personal workspaces, projects, expiring and rotatable API keys with shared daily quota lineage, and transactional credit ledger.
- **Account Lifecycle (Export & Deletion)**: GDPR-ready JSON account data export (`/api/account/export`) and safe tenant-bounded account deletion (`/api/account/delete`) with verified session confirmation.
- **Admin Console & Operations**: Root-only operations overview (`/admin/operations`), literal user search, audit log query across platform settings and AI operations, system diagnostics, and transactional user credit adjustments (`/api/admin/users/credits`) with audit recording.
- **AI Studio & Prompt Lab**: Immutable prompt versioning, provider testing, optimistic-locked activation, trace metadata recording, and verified runtime rollback.
- **Self-Hosted Deployment (Docker Compose)**: Complete `compose.saas.yaml` stack deploying Next.js standalone application, PostgreSQL 17, automated idempotent schema migrator (`scripts/migrate-selfhost.ts`), and SMTP configuration with health check (`/api/v1/health`).
- **Backup & Restore**: Automated database backup and restore verification (`scripts/test-backup-restore.ts`) proving synthetic data preservation, table parity, and schema readiness.

## Verification Proof

| Check | Result | Evidence |
| --- | --- | --- |
| Unit & Integration Tests | **147 passed, 0 failed, 0 skipped** across 35 test files | `npm test` against disposable `overto_test` database |
| TypeScript Compilation | **0 errors** | `npx tsc --noEmit` exited with code 0 |
| ESLint Code Quality | **0 errors, 0 warnings** | `npm run lint` exited with code 0 |
| Documentation Links | **40 Markdown files, 153 links, 0 failures** | `npm run docs:check` exited with code 0 |
| Production Build | **54 static & dynamic routes compiled** | `npm run build` exited with code 0 |
| Self-Host Docker E2E | **1 passed in 4.8s** | `e2e/selfhost.e2e.ts` on live Docker Compose container at `127.0.0.1:3006` |
| Backup & Restore | **100% table parity & record recovery verified** | `npx tsx scripts/test-backup-restore.ts` exited with code 0 |
| Prompt Activation Chain | **Verified end-to-end** | `src/server/ai/__tests__/prompt-activation-chain.integration.test.ts` passed |
| Migration Idempotency | **Verified initial & rerun** | `scripts/__tests__/migrate-schema.integration.test.ts` passed |

## Local & Self-Hosted Verification Commands

```sh
# 1. Run unit & integration tests
SITE_CONFIG_TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:55446/overto_test" \
LEDGER_TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:55446/overto_test" \
npm test

# 2. Run TypeScript and ESLint
npx tsc --noEmit && npm run lint

# 3. Test backup and restoration
npx tsx scripts/test-backup-restore.ts

# 4. Verify Docker Compose deployment
PLAYWRIGHT_CHROMIUM_EXECUTABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
OVERTO_SELFHOST_E2E=true npx playwright test e2e/selfhost.e2e.ts

# 5. Production build
npm run build
```

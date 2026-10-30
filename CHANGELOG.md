# Changelog

All notable changes to OvěřTo.AI are documented in this file.

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

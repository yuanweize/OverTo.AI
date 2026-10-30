# Implementation status — local 7.0 development build

Updated 2026-10-30. This worktree is **not a production SaaS release**. Public `main` remains `ad56cc9` with the `competition-2026.10.29` release. The local `release/overto-7` branch was created from the public-history preview branch for continued delivery. Preserve private recovery refs and local database volumes.

## Working locally

- Public Czech/English home, analysis, pricing, developer API, documentation, features, process, security, privacy and development terms pages. Browser language is detected with Czech fallback; users can choose a language and Light/Dark/System theme. The privacy review and analysis results expose the actual rules/AI mode, grounded evidence and uncertainty.
- Optional OpenAI-compatible adapter uses the server's existing `OPENAI_BASE_URL`, `OPENAI_API_KEY` and model. A root admin can name the provider and select only operator-registered endpoints, models, timeout and output cap. The key is not stored in site settings or shown in the UI. Production paid AI is deliberately blocked. One earlier synthetic local model request succeeded; a later Prompt Lab request was rate-limited. These are connectivity observations, not fraud accuracy evidence.
- Local Better Auth signup, email verification, password reset, sessions and logout using loopback PostgreSQL and Mailpit. Verified users get a personal workspace, projects and ten test credits. Project keys are hashed, scoped, expiring and rotatable; rotation shares the daily quota lineage. The key list shows current UTC-day admitted requests from the same PostgreSQL bucket used by the API. A real browser journey confirmed 2 requests, rotation retaining 2, then 3 after a Playground call. API requests require an idempotency key and consume local credits after admission. Shared PostgreSQL per-key, per-project and per-workspace admission is verified for concurrent requests. Message text is not persisted in the application database.
- Root-only site settings, audit, AI traces, immutable Prompt Lab versions, synthetic rules evaluation, provider settings and model-ID management. Model management reuses the audited provider configuration; it does not verify model availability or price. An explicit, rate-limited `/models` diagnostic sends no message text and reports only status and duration. Prompt activation requires a recent successful test of the exact version and model. No successful activation after the latest external rate limit is claimed.
- Root-only operations pages now show actual local account, test subscription, audit and basic system data. Search uses bounded, literal prefix matching. The pages remain read-only and do not complete production account or billing administration.
- Experimental Stripe **test mode** Checkout, signed webhook, one five-credit subscription grant, portal access and cancellation were exercised with a real sandbox session. Event replay did not duplicate the grant and invalid signatures were rejected. Renewal, failed invoices, refunds and reconciliation are not yet accepted. See [sandbox evidence](../saas/stripe-live-test.md).
- Rules-only Docker image and loopback Compose prototype. It does not deploy the local SaaS account system.

## Latest checks

| Check | Result |
| --- | --- |
| Unit and isolated PostgreSQL integration tests | 129 passed, 0 failed, 0 skipped across 29 files against the disposable `overto_test` database after the operations pages |
| TypeScript | `npx tsc --noEmit` passed after the documentation, home, dashboard and Studio changes |
| ESLint | `npm run lint` passed after those changes |
| Documentation links | Public candidate tree: 38 Markdown files; local links, anchors and remote HTTP URLs checked; 0 failures |
| Browser | Current standard suite: 10 passed, 1 skipped (privileged test intentionally disabled). Separate privileged visual and full settings/Studio runs: 1 passed each, including all new operations routes, anonymous 404, wildcard-literal search and English/Czech plus mobile dark captures. |
| Production build | `npm run build` passed after the new operations pages; documentation and browser assertions changed afterward. |

Real screenshots are in `assets/screenshots/`. They show synthetic accounts and test data. [Visual review](../design/FINAL-VISUAL-REVIEW.md) records three rounds, reviewed viewports and remaining design issues. The public [OpenRouter reference review](../design/OPENROUTER-REFERENCE-REVIEW.md) distinguishes visible pages from private ones. Independent [test plans](../testing/FULL-E2E-TEST-PLAN.md) are available.

## Local setup and safety

Use a disposable PostgreSQL database on `127.0.0.1:55443/overto` and loopback Mailpit on ports 1025/8025. Set `OVERTO_AUTH_LOCAL=true`, `OVERTO_LOCAL_VERIFY_EMAIL=true`, `OVERTO_DEV_DATABASE_URL`, `OVERTO_AUTH_SECRET` and `BETTER_AUTH_URL=http://127.0.0.1:3005` in ignored `.env.local`. Run `npx tsx scripts/migrate-auth.ts`, then `npm run dev -- --hostname 127.0.0.1 -p 3005`. The migration intentionally refuses any other database endpoint. Mailpit contains one-time links; do not expose it or use real identities. Isolated integration tests require `SITE_CONFIG_TEST_DATABASE_URL` and `LEDGER_TEST_DATABASE_URL` pointing only to the disposable local `overto_test` database, never the account database.

## Unfinished release gates

Production authentication and email, team membership, account deletion, audited admin account actions, distributed anonymous admission, provider monetary budgets, continuous model availability monitoring and fallback routing, OCR, representative fraud accuracy evaluation, full billing lifecycle, a production SaaS Compose deployment, GHCR and a safe public 7.0 release remain unfinished. The public API guest path still has only process-local protection. No public DNS change has been authorized. See the [acceptance matrix](ACCEPTANCE-MATRIX.md) and [next actions](NEXT-ACTIONS.md).

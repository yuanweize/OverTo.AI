# Next actions

1. Read `IMPLEMENTATION-STATUS.md` and `ACCEPTANCE-MATRIX.md`, inspect the active worktree and preserve its private history. Check `http://127.0.0.1:3005` and the dedicated `overto-local-postgres` container; do not replace or delete its volume.
2. Finish account security: configure and verify real transactional mail delivery, production session settings, server-side tenant authorization and distributed abuse controls. Local Mailpit verification and recovery are tested but cannot deliver real mail. Review Better Auth session/CSRF settings and add HTTP security tests.
3. Complete project deletion, web analysis project selection, ownership and membership. Harden the local analysis-ledger integration with provider-failure and cancellation HTTP tests, scheduled crash recovery, reconciliation and production authorization; preserve metadata-only usage and do not store message text by default.
4. Harden local project-scoped API keys and playground: configurable scopes, rotation, expiry and usage caps, expiry tests, rate limiting, production authentication and per-project usage display.
5. Implement Stripe test-only checkout, signed webhook idempotency and reconciliation; run end-to-end test mode without live charges. Add protected audited admin operations.
6. Complete missing pages and detailed visual/accessibility review, automated browser journeys, production migrations, Docker Compose database setup, GHCR, and authorized HTTPS deployment. Record exact blockers and test results.

Useful checks: `npm test`; `npm run lint`; `npm run build`; `PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npx playwright test`. Use a fresh dedicated PostgreSQL database for `LEDGER_TEST_DATABASE_URL`. `npm run ai:check` makes a potentially billable provider request and must use synthetic text only.

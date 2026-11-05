# Current maintenance status — 2026-11-05

Current billing work: PR #17 fixed administrator grant atomicity and idempotency and merged to main. The formal checkout now has an independent Git database; the legacy worktree and audit directory are in a private archive with verified Git bundles and working-tree archives. Rebuildable caches were moved to the system Trash. Branch `fix/ledger-refund-reversals` changes Test Mode refund accounting to append compensating entries and includes PostgreSQL replay/ordering tests. Formal subscription, top-up, Live payment architecture and the expanded billing/admin journeys remain unimplemented and must not be represented as released.

Prior audit baseline `main` (2026-11-04): `f4f9f5430d8e6b76d38acf13ca1f23bcb59450ee`. The published release at that audit was `v7.0.3`; check GitHub for newer commits and releases. The public Render deployment record reported this SHA as successful, but the running application did not expose a build SHA, so direct runtime provenance was unverified.

The v7 release scope is the personal-workspace, rules-first SaaS described in [the acceptance matrix](ACCEPTANCE-MATRIX.md). The implementation in PR #16 permits production inference only with explicit enablement, confirmed model pricing and a budget permit; the public demo and Render configuration still default to Rules-only. The isolated HTTPS Mock Provider E2E passed, but no real paid provider or public production deployment has been verified. Optional PostHog telemetry is consent-gated and was tested against an isolated QA stack; the shared EU project received a synthetic event and has a production-filtered [OvěřTo.AI dashboard](https://eu.posthog.com/project/334746/dashboard/1085613). Organization membership and OCR are unimplemented optional work, not completed release features. Stripe is Test Mode only; live payments are not launched.

Maintenance actions:

1. Reproduce a specific defect against current `main` before changing a stable module.
2. Use an isolated PostgreSQL database and synthetic accounts for integration and browser tests.
3. Preserve existing worktrees, private configuration and Compose volumes during local audits; use an isolated database for tests.
4. Publish a new tag only when a versioned release is requested and its CI, container, documentation and deployment evidence have been reviewed.

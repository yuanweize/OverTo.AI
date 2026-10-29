# Acceptance matrix — 2026-10-30 local build

Statuses distinguish working local experiments from a production SaaS release. Screenshots contain synthetic content. See [implementation status](IMPLEMENTATION-STATUS.md) for setup and test counts.

| Area | Routes / module | Current evidence | Status |
| --- | --- | --- | --- |
| Public website | `/`, `/analyze`, `/pricing`, `/developers`, `/docs`, `/features`, `/how-it-works`, `/security`, `/privacy`, `/terms` | Three screenshot rounds at desktop/tablet/mobile, revised hero and new bilingual `/docs`; analysis and API rules requests exercised | Local, partially reviewed |
| Language and theme | Czech/English, Light/Dark/System | Browser override and fallback tests; English and Czech dark/light captures | Local, partial accessibility audit |
| Rules and evidence | `/api/analyze`, `/api/v1/analyses`, action graph | Schema, span grounding, ambiguity and request tests; no URL fetch | Local, no representative accuracy claim |
| AI adapter | OpenAI-compatible endpoint in server config | Synthetic live connectivity success before a later provider rate limit; mocked malformed/429/failure tests | Local only, production blocked |
| Provider / model admin | `/admin/ai-studio/providers`, `/admin/ai-studio/models`, explicit `/models` diagnostic | Root-only audited settings, endpoint allowlist, model registry save/restore in browser; diagnostic mock tests | Local, no price or model-capability guarantee |
| Prompt Lab | `/admin/ai-studio/prompts` | Immutable versions and activation gate integration tests; browser creation and untested-activation denial | Partial: live activation not accepted |
| Evaluations | `/admin/ai-studio/evaluations`, `/admin/ai-studio/datasets` | Authored rules dataset saved in earlier browser run; later repeated run intentionally hit shared limit | Partial, no accuracy certification |
| Traces | `/admin/ai-studio`, metadata repository | Isolated PostgreSQL test, 24-hour summaries, no message text | Local |
| Auth and account | `/signup`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password`, `/dashboard` | Mailpit browser journey, unverified denial, reset session revocation, logout | Local only; production disabled |
| Projects and keys | `/dashboard/projects`, `/dashboard/api-keys`, `/dashboard/playground` | Cross-account isolation, archived-key rejection, scope denial, rotation, expiry and daily quota concurrency; actual used/limit shown before and after rotation in browser | Local only |
| Credits and usage | `/dashboard/analyze`, `/dashboard/usage` | Concurrent reservations, duplicate rejection, project-scoped usage; compact actual-data summary and structured Playground response inspected in browser | Local test credits |
| Billing | `/dashboard/billing`, Stripe test routes | Actual sandbox checkout, signed webhook, one credit grant, portal and cancellation; replay and bad signature checks | Experimental; renewal/refunds/reconciliation pending |
| Site administration | `/admin` | Verified ROOT, audited configuration, version conflicts, browser save/restore | Local only |
| Docker and deployment | Dockerfile, Compose | Rules-only container was previously smoked on arm64 | SaaS self-hosting incomplete |
| Public release | GitHub `competition-2026.10.29` | Public `main` and competition release remain unchanged; 7.0 is published as a preview branch only | No 7.0 release |

## Release gates

Gate A (visual product) is partial after the OpenRouter-inspired third review round. Gate B (AI platform) is partial. Gate C (SaaS) is local-only. Gate D (admin) is partial. Gate E (security) fails for anonymous abuse control and provider budgets. Gate F (open-source self-hosting) fails for SaaS Compose/GHCR. Gate G (new public release) has not started. Do not describe this worktree as production-ready.

# Shared request admission

The local account deployment uses PostgreSQL-backed fixed-window limits, so separate Node processes using the same database share counters:

| Scope | Limit |
|---|---:|
| Verified test API key | 30 requests / minute |
| Test API key lineage | Configured 1–100,000 requests / 24-hour fixed window; default 1,000. Rotation keeps the same lineage. |
| Authorized project | 40 requests / minute |
| Personal workspace | 60 requests / minute |
| Guest analysis, all visitors combined | 90 requests / minute and 3,000 requests / day |
| Guest AI attempt, all visitors combined | 4 requests / minute and 24 requests / day, in addition to guest analysis limits |

The key, lineage, workspace and project counters consume atomically: either all applicable scopes admit the request or none are incremented. Minute keys are bucketed by their stored SHA-256 hash; daily keys use a persistent opaque lineage ID, never the plaintext bearer token. Workspace/project identifiers come from authorized server lookups. Shared admission precedes credit reservation and provider invocation; database failure returns 503. Exhaustion returns 429 and Retry-After. Existing credit reservations still govern balance and duplicate request handling. Separate coarse per-process limits remain as overload protection.

Tests use two independent connection pools and 30 concurrent requests against a shared limit of seven, verify exactly seven admissions, and verify rollback when a second scope is exhausted. Key tests use concurrent rotation and two independent pools to verify a shared three-request daily lineage limit, policy bounds and cross-account isolation. This validates transaction behavior, not a load capacity or performance SLA.

The guest counters apply to both `/api/analyze` and unauthenticated `/api/v1/analyses`. A database failure returns 503 before analysis in the local account deployment. A rules request and a v1 guest request each increment the shared daily bucket once in live local checks. The AI counter bounds request count, **not provider cost**. A single visitor can still exhaust the shared allowance for everyone; there is no trusted visitor identity or per-IP fairness yet.

Limitations: fixed windows can allow a burst around their boundary. The current limits are code-defined, not administrator configurable. There is no shared visitor IP policy, monetary model budget or distributed provider concurrency lease yet. The rules-only Docker deployment has no PostgreSQL and still has only process-local protection. Outside the dedicated local account deployment, an AI request produces an unavailable-AI rules fallback even if `AI_ENABLED=true`; no paid provider call is made. This is not authorization to expose either deployment publicly.

Expired counter cleanup is available through `SharedRateLimiter.prune()`; scheduled invocation is not wired yet. Do not retain unbounded counters in a long-running deployment. Buckets contain internal opaque identifiers/hashes, not raw IPs or message text.

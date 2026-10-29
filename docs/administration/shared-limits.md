# Shared request admission

The local authenticated account path now uses PostgreSQL-backed fixed-window limits, so separate Node processes using the same database share counters:

| Scope | Limit |
|---|---:|
| Verified test API key | 30 requests / minute |
| Test API key lineage | Configured 1–100,000 requests / 24-hour fixed window; default 1,000. Rotation keeps the same lineage. |
| Authorized project | 40 requests / minute |
| Personal workspace | 60 requests / minute |

The key, lineage, workspace and project counters consume atomically: either all applicable scopes admit the request or none are incremented. Minute keys are bucketed by their stored SHA-256 hash; daily keys use a persistent opaque lineage ID, never the plaintext bearer token. Workspace/project identifiers come from authorized server lookups. Shared admission precedes credit reservation and provider invocation; database failure returns 503. Exhaustion returns 429 and Retry-After. Existing credit reservations still govern balance and duplicate request handling. Separate coarse per-process limits remain as overload protection.

Tests use two independent connection pools and 30 concurrent requests against a shared limit of seven, verify exactly seven admissions, and verify rollback when a second scope is exhausted. Key tests use concurrent rotation and two independent pools to verify a shared three-request daily lineage limit, policy bounds and cross-account isolation. This validates transaction behavior, not a load capacity or performance SLA.

Limitations: fixed windows can allow a burst around their boundary. The current limits are code-defined, not administrator configurable. There is no shared visitor IP policy, global paid-model spending budget or distributed provider concurrency lease yet. Anonymous rules requests still have only process-local protection. Production AI remains blocked. This is not authorization to expose the local account experiment publicly.

Expired counter cleanup is available through `SharedRateLimiter.prune()`; scheduled invocation is not wired yet. Do not retain unbounded counters in a long-running deployment. Buckets contain internal opaque identifiers/hashes, not raw IPs or message text.

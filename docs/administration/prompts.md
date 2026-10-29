# Prompt Lab

Verified root administrators use `/admin/ai-studio/prompts` to create immutable instruction versions, run real synthetic tests, inspect version hashes and test telemetry, activate a tested version, and restore the built-in baseline. This remains local administration; it does not bypass the production AI gate.

## Version and activation semantics

Each version has a UUID, SHA-256 hash and creator. Database triggers reject updates or deletion of saved versions. Changes create new versions. Every create, test and activation produces an audit event. Instruction text is intentionally stored as operator configuration: never place keys, private messages or personal data in it.

Activation uses an optimistic version and a row lock. It requires a successful latest test of that exact immutable version and the configured model within seven days. A newer failed test blocks activation. Root permission and verified email are checked again inside the mutation transaction. Restoring the built-in `semantic-v1` baseline is allowed without a new provider call. This technical gate is **not** a representative evaluation or safety certification.

## Real testing and privacy

A test requires explicit consent and an editable synthetic message, then uses the same sanitization, provider adapter, output schema and grounding checks as analysis. It can incur charges from the configured model provider. It does not consume local user test credits. Shared PostgreSQL admission limits tests to five per root per minute; this is not a monetary budget. The production provider gate still applies.

Tests store status, requested model, duration and reported tokens, plus a trace. Message text and raw responses are not stored. Missing tokens and prices remain unknown. The UI response includes the filtered structured output for inspection. Standalone `ai:check` continues to test the built-in prompt; web and versioned API requests load the active database version and expose `metadata.promptVersion`.

## Verification

Isolated PostgreSQL tests verify authorization, immutable storage, model-specific test requirements, concurrent activation conflict handling, rollback, re-verification and metadata-only persistence. The optional browser test `OVERTO_LIVE_PROMPT_E2E=true` performs real provider requests, verifies activation reaches an analysis response, then restores the prior baseline. Standard CI never enables paid model calls.

## Remaining work

Semantic output comparison, representative dataset evaluation and controlled model/rule releases remain unfinished. A successful synthetic test does not establish recommendation safety, fraud accuracy or production reliability.

The browser can compare two stored tests by model, status, latency, token reports, grounded-signal counts and rejection counts. Message bodies are not retained, so this is an operational comparison, not an accuracy ranking. Earlier records may have unknown fields.

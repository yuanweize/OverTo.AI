# AI traces

Local verified platform administrators can open `/admin/ai-studio`. The page displays 24-hour request counts, successful/failed/blocked calls, measured mean provider duration, reported token coverage and the latest 100 traces. It does not infer current provider health from a historical success or interpret a successful API request as a correct fraud classification.

Each requested AI analysis at `/api/analyze` (including its v1 and local-metered wrappers) receives a trace ID. When the configured local database is available, metadata is stored transactionally as one row. The response explicitly reports `metadata.traceRecorded`; logging failure does not discard the analysis. Rules-only requests do not create an AI trace. The standalone `ai:check` diagnostic calls the adapter directly and does not persist a trace.

Stored fields: trace ID, timestamp, provider category, model, selected prompt version, status/failure classification, provider duration, reported input/output tokens, rejected-evidence count and nullable estimated cost. The schema has no raw message, complete prompt, user email, IP, API key or exception-text fields. Token values remain unknown when the provider omits usage. Cost remains null until a reviewed pricing model is implemented. Operator-configured model names should contain no secrets.

Live synthetic HTTP verification on 2026-10-29: `gpt-5.6-terra`, successful grounded response, trace persisted, 366 input and 344 output tokens, 15,281 ms total observed HTTP duration. This is a single connectivity/observability check, not a reliability benchmark. Provider behavior can change.

Limitations: no per-tenant trace access, retention job, model activation or evaluation runner UI yet. This is local administration only; production auth and shared budget enforcement remain closed. Do not use the trace UI as evidence that those controls exist.

[Prompt Lab](prompts.md) now provides immutable versions, real tests and audited activation/rollback.

# Local evaluation console

Verified root administrators can inspect the repository's authored `challenge-v1` cases at `/admin/ai-studio/datasets` and run evaluations at `/admin/ai-studio/evaluations`. Database records retain the requested mode, selected model and prompt, dataset version, case identifiers, decisions, timings and token metadata. They do not store message bodies. The latest 30 runs are visible.

Rules-only runs execute every case. LLM-only and hybrid runs require explicit consent and are capped at the first four synthetic cases, sequentially. This small subset is a connectivity check, not representative model accuracy. Shared PostgreSQL admission permits one evaluation every five minutes across instances. Failures produce null decisions; hybrid fallback is not counted as successful AI evaluation.

The binary convention treats HIGH_RISK as positive and excludes ambiguous ground truth. False-positive and false-negative rates use completed labeled cases only and remain null for empty denominators. Missing tokens remain null. Grounding validation is not semantic correctness; recommendation safety is not measured. Authored labels have not been independently reviewed.

The console uses the same rule engine, model adapter, sanitization and decision policy as application analysis. The older command-line report retains its historical research-only LLM decision convention; do not directly equate its results with console runs.

Current limits: datasets are repository-managed, not browser-editable; jobs execute within the request, not a durable background queue. A terminated process may leave a RUNNING record, which must not be interpreted as completed. No public production readiness is claimed.

# Architecture

Browser input → best-effort client redaction → editable review and optional AI consent → bounded API request → server redaction → deterministic rules and offline URL checks → optional OpenLux structured analysis → runtime schema and evidence checks → decision → controlled verification guidance. The application does not fetch user-supplied URLs. See [AI_USAGE.md](AI_USAGE.md) and [PRIVACY.md](PRIVACY.md).

The optional model can add risk signals; it cannot downgrade a deterministic critical result. A matched quote establishes only that text appears in the input, not that the model interpreted it correctly. Rules, category-based decision policy and curated actions are heuristic; see the evaluation report. Provider failures result in a labeled rules-only response.

The experimental action graph links only exact UTF-16 spans in sanitized text to a proposed signal or request. Links do not establish causality. `POST /api/v1/analyses` is a non-persistent wrapper around the same engine; see `docs/api/v1.md`. No authentication, admin control plane, or database is implemented.

# Architecture

Browser input → best-effort client redaction → editable review and optional AI consent → bounded API request → server redaction → deterministic rules and offline URL checks → optional OpenAI structured analysis → runtime schema and evidence checks → decision → controlled verification guidance. The application does not fetch user-supplied URLs. See [AI_USAGE.md](AI_USAGE.md) and [PRIVACY.md](PRIVACY.md).

The optional model can add risk signals; it cannot downgrade a deterministic critical result. A matched quote establishes only that text appears in the input, not that the model interpreted it correctly. Rules, score thresholds and curated actions are heuristic; see the evaluation report. Provider failures result in a labeled rules-only response.

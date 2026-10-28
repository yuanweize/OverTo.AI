# Evaluation

`npm run eval` runs a 33-case self-authored synthetic challenge set. It is neither independently annotated nor representative, and it is not a blind holdout. The generated [report](docs/evaluation/ai-evaluation.md) separates all three decisions and reports under-warning and false alarms. The old 100 cases remain a development set, runnable with `npm run eval:legacy`; historical perfect-score claims are not valid general performance claims.

`npm run eval -- --live` explicitly requests paid model calls if configured. Failed or unavailable calls are excluded from AI-mode results, not counted as model success. No live model comparison or independent recommendation-safety review has been completed. See [methodology](docs/evaluation/methodology.md) and [failure analysis](docs/evaluation/failure-analysis.md).

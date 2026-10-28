# Live synthetic mini-evaluation

Run: 2026-10-28T18:08:25.854Z. Four self-authored synthetic development cases, not independent, blinded or representative. Model: gpt-5.6-terra; configured service: local or approved gateway. Rules-only and hybrid use the same examples; AI-only is a research heuristic derived from the same model response, not a separate call. Unavailable model outcomes are not counted as hybrid or AI-only successes. This tiny sample cannot establish AI improvement or real-world performance.

| Case | Working label | Rules | AI-only heuristic | Hybrid | Provider status | Hybrid ms | Rejected quotes |
|---|---|---|---|---|---|---:|---:|
| family-scam | MALICIOUS | HIGH_RISK | HIGH_RISK | HIGH_RISK | SUCCESS | 19764 | 0 |
| family-normal | BENIGN | INSUFFICIENT_EVIDENCE | INSUFFICIENT_EVIDENCE | INSUFFICIENT_EVIDENCE | SUCCESS | 3982 | 0 |
| bank-code | MALICIOUS | HIGH_RISK | HIGH_RISK | HIGH_RISK | SUCCESS | 15341 | 0 |
| ambiguous | AMBIGUOUS | INSUFFICIENT_EVIDENCE | INSUFFICIENT_EVIDENCE | INSUFFICIENT_EVIDENCE | SUCCESS | 7717 | 0 |

Model interpretation, recommendation safety and actual cost were not independently reviewed. Response latency is in-process, not a network-wide performance benchmark.

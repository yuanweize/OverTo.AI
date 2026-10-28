# Synthetic challenge evaluation

Run: 2026-10-28T18:07:54.112Z; commit: 77e98cf; dirty worktree: true; Node: v26.5.0; live requested: false; configured model: not used; dataset: challenge v1, 33 cases. Authored and labeled in this development session, not independently reviewed, representative or blinded. The dataset was not part of the legacy 100 cases but is not a held-out benchmark.

## RULES_ONLY

Completed: 33/33; unavailable/failed: 0. Failures are excluded, not replaced by rules output.

| Ground truth | HIGH_RISK | VERIFICATION_RECOMMENDED | INSUFFICIENT_EVIDENCE |
|---|---:|---:|---:|
| MALICIOUS | 2 | 6 | 7 |
| BENIGN | 1 | 4 | 7 |
| AMBIGUOUS | 0 | 1 | 5 |

Binary convention: HIGH_RISK positive; both other decisions negative; ambiguous excluded. Precision 66.7%; recall 13.3%; F1 22.2%; FPR 8.3%; FNR 86.7%. Abstention (INSUFFICIENT_EVIDENCE) 57.6%.

Malicious cases at INSUFFICIENT_EVIDENCE: 7; other malicious cases below HIGH_RISK: 6. Cases: `bank-1` (INSUFFICIENT_EVIDENCE), `bank-2` (INSUFFICIENT_EVIDENCE), `parcel-1` (VERIFICATION_RECOMMENDED), `parcel-2` (VERIFICATION_RECOMMENDED), `family-1` (INSUFFICIENT_EVIDENCE), `family-2` (INSUFFICIENT_EVIDENCE), `market-1` (INSUFFICIENT_EVIDENCE), `market-2` (VERIFICATION_RECOMMENDED), `invest-1` (INSUFFICIENT_EVIDENCE), `government-1` (VERIFICATION_RECOMMENDED), `remote-1` (INSUFFICIENT_EVIDENCE), `inject-1` (VERIFICATION_RECOMMENDED), `inject-2` (VERIFICATION_RECOMMENDED).

| Category | Completed | High | Verify | Insufficient |
|---|---:|---:|---:|---:|
| banking | 5 | 1 | 0 | 4 |
| delivery | 5 | 0 | 2 | 3 |
| education | 2 | 1 | 0 | 1 |
| family | 5 | 0 | 0 | 5 |
| government | 2 | 0 | 1 | 1 |
| injection | 4 | 1 | 2 | 1 |
| investment | 1 | 0 | 0 | 1 |
| marketplace | 3 | 0 | 1 | 2 |
| quoted | 1 | 0 | 1 | 0 |
| remote-access | 1 | 0 | 0 | 1 |
| url | 4 | 0 | 4 | 0 |

Mean in-process time per attempt: 0.16 ms. No model was called. Evidence hallucination rate: not measured in this mode. Recommendation safety, user outcomes and API cost: not measured.

## LLM_ONLY and HYBRID_AI

Not run. A live run requires explicit `npm run eval -- --live` and correctly configured AI access. Mock inference is not live validation. No paid calls were made by this default run.

## Interpretation

The LLM-only decision is a research mapping from grounded risk-signal severity and is not a production decision. Both approaches can miss fraud or over-warn. This evaluation cannot demonstrate real-world AI improvement, actual-user benefit, resistance to injection or model accuracy. AI-only and hybrid comparison requires successful real calls on the same dataset and an independent annotation protocol.

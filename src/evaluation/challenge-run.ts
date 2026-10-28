/** Challenge set evaluation. Live provider use is explicit, never the default. */
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { analyzeSuspiciousMessage } from '../lib/decision-engine';
import { runLlmAnalysisIfConfigured } from '../lib/llm-adapter';
import { sanitizeInput } from '../lib/sanitizer';
import { CHALLENGE_SET, type ChallengeCase, type Truth } from './challenge-dataset';
import type { RiskLevel } from '../types/analyzer';

type Mode = 'RULES_ONLY' | 'LLM_ONLY' | 'HYBRID_AI';
type Row = { item: ChallengeCase; decision: RiskLevel | null; elapsed: number; status: string; grounded?: number; rejected?: number };
const levels: RiskLevel[] = ['HIGH_RISK', 'VERIFICATION_RECOMMENDED', 'INSUFFICIENT_EVIDENCE'];
const truths: Truth[] = ['MALICIOUS', 'BENIGN', 'AMBIGUOUS'];
const pct = (a: number, b: number) => b ? `${(100 * a / b).toFixed(1)}%` : 'n/a';

async function measure(mode: Mode): Promise<Row[]> {
  const rows: Row[] = [];
  for (const item of CHALLENGE_SET) {
    // Emulate the browser privacy transformation before evaluating the engine.
    const input = sanitizeInput(item.text).sanitizedText;
    const start = performance.now();
    if (mode === 'LLM_ONLY') {
      const outcome = await runLlmAnalysisIfConfigured(input);
      if (outcome.status !== 'SUCCESS' || !outcome.analysis) {
        rows.push({ item, decision: null, elapsed: performance.now() - start, status: outcome.status });
        continue;
      }
      const signals = outcome.analysis.riskSignals;
      // Research-only heuristic; the production system uses its own decision policy.
      const decision: RiskLevel = signals.some(s => s.severity === 'CRITICAL' || s.severity === 'HIGH')
        ? 'HIGH_RISK' : signals.length ? 'VERIFICATION_RECOMMENDED' : 'INSUFFICIENT_EVIDENCE';
      rows.push({ item, decision, elapsed: performance.now() - start, status: 'SUCCESS',
        grounded: signals.length + outcome.analysis.requestedActions.length,
        rejected: outcome.rejectedEvidence ?? 0 });
    } else {
      const result = await analyzeSuspiciousMessage(input, mode === 'HYBRID_AI');
      const status = mode === 'RULES_ONLY' ? 'SUCCESS' : result.metadata.aiStatus;
      // An unavailable or failed model is not a hybrid result.
      rows.push({ item, decision: status === 'SUCCESS' ? result.riskLevel : null,
        elapsed: performance.now() - start, status });
    }
  }
  return rows;
}

function reportMode(mode: Mode, rows: Row[]): string {
  const ok = rows.filter(r => r.decision !== null);
  const count = (truth: Truth, level: RiskLevel) => ok.filter(r => r.item.truth === truth && r.decision === level).length;
  const tp = count('MALICIOUS', 'HIGH_RISK'), fp = count('BENIGN', 'HIGH_RISK');
  const fn = count('MALICIOUS', 'VERIFICATION_RECOMMENDED') + count('MALICIOUS', 'INSUFFICIENT_EVIDENCE');
  const tn = count('BENIGN', 'VERIFICATION_RECOMMENDED') + count('BENIGN', 'INSUFFICIENT_EVIDENCE');
  const p = tp + fp ? tp / (tp + fp) : 0, r = tp + fn ? tp / (tp + fn) : 0;
  const f1 = tp + fp && tp + fn && p + r ? pct(2 * p * r, p + r) : 'n/a';
  const categories = [...new Set(CHALLENGE_SET.map(c => c.category))].sort();
  const underwarn = ok.filter(row => row.item.truth === 'MALICIOUS' && row.decision !== 'HIGH_RISK');
  const rejected = ok.reduce((n, row) => n + (row.rejected ?? 0), 0);
  const grounded = ok.reduce((n, row) => n + (row.grounded ?? 0), 0);
  return `## ${mode}\n\nCompleted: ${ok.length}/${rows.length}; unavailable/failed: ${rows.length - ok.length}. Failures are excluded, not replaced by rules output.\n\n| Ground truth | HIGH_RISK | VERIFICATION_RECOMMENDED | INSUFFICIENT_EVIDENCE |\n|---|---:|---:|---:|\n${truths.map(t => `| ${t} | ${levels.map(l => count(t, l)).join(' | ')} |`).join('\n')}\n\nBinary convention: HIGH_RISK positive; both other decisions negative; ambiguous excluded. Precision ${pct(tp, tp + fp)}; recall ${pct(tp, tp + fn)}; F1 ${f1}; FPR ${pct(fp, fp + tn)}; FNR ${pct(fn, tp + fn)}. Abstention (INSUFFICIENT_EVIDENCE) ${pct(ok.filter(x => x.decision === 'INSUFFICIENT_EVIDENCE').length, ok.length)}.\n\nMalicious cases at INSUFFICIENT_EVIDENCE: ${count('MALICIOUS', 'INSUFFICIENT_EVIDENCE')}; other malicious cases below HIGH_RISK: ${count('MALICIOUS', 'VERIFICATION_RECOMMENDED')}. Cases: ${underwarn.map(x => `\`${x.item.id}\` (${x.decision})`).join(', ') || 'none in completed cases'}.\n\n| Category | Completed | High | Verify | Insufficient |\n|---|---:|---:|---:|---:|\n${categories.map(c => { const rs = ok.filter(x => x.item.category === c); return `| ${c} | ${rs.length} | ${levels.map(l => rs.filter(x => x.decision === l).length).join(' | ')} |`; }).join('\n')}\n\nMean in-process time per attempt: ${rows.length ? (rows.reduce((n, x) => n + x.elapsed, 0) / rows.length).toFixed(2) : 'n/a'} ms. ${mode === 'RULES_ONLY' ? 'No model was called.' : `Model failure/unavailability: ${pct(rows.length - ok.length, rows.length)}; statuses: ${[...new Set(rows.map(x => x.status))].map(status => `${status}=${rows.filter(x => x.status === status).length}`).join(', ')}.`} ${mode === 'LLM_ONLY' ? `Grounding filter rejected ${rejected} of ${rejected + grounded} proposed evidence-bearing items (${pct(rejected, rejected + grounded)}); this measures exact-substring rejection, not semantic truth.` : 'Evidence hallucination rate: not measured in this mode.'} Recommendation safety, user outcomes and API cost: not measured.\n`;
}

async function main() {
  const live = process.argv.includes('--live');
  const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;
  const rules = await measure('RULES_ONLY');
  // The explicit flag is required because calls incur charges and disclose synthetic content to the provider.
  const model = live ? await measure('LLM_ONLY') : [];
  const hybrid = live ? await measure('HYBRID_AI') : [];
  const report = `# Synthetic challenge evaluation\n\nRun: ${new Date().toISOString()}; commit: ${commit}; dirty worktree: ${dirty}; Node: ${process.version}; live requested: ${live}; configured model: ${live ? (process.env.OPENAI_MODEL || 'gpt-6.1-sol') : 'not used'}; dataset: challenge v1, ${CHALLENGE_SET.length} cases. Authored and labeled in this development session, not independently reviewed, representative or blinded. The dataset was not part of the legacy 100 cases but is not a held-out benchmark.\n\n${reportMode('RULES_ONLY', rules)}\n${live ? reportMode('LLM_ONLY', model) + '\n' + reportMode('HYBRID_AI', hybrid) : '## LLM_ONLY and HYBRID_AI\n\nNot run. A live run requires explicit `npm run eval -- --live` and correctly configured AI access. Mock inference is not live validation. No paid calls were made by this default run.\n'}\n## Interpretation\n\nThe LLM-only decision is a research mapping from grounded risk-signal severity and is not a production decision. Both approaches can miss fraud or over-warn. This evaluation cannot demonstrate real-world AI improvement, actual-user benefit, resistance to injection or model accuracy. AI-only and hybrid comparison requires successful real calls on the same dataset and an independent annotation protocol.\n`;
  writeFileSync('docs/evaluation/ai-evaluation.md', report);
  const failures = rules.filter(x => (x.item.truth === 'MALICIOUS' && x.decision !== 'HIGH_RISK') || (x.item.truth === 'BENIGN' && x.decision === 'HIGH_RISK'));
  writeFileSync('docs/evaluation/failure-analysis.md', `# Rules-only failure review\n\nGenerated from the synthetic challenge run at ${new Date().toISOString()}. These are hypotheses from case design, not independently verified incidents.\n\n${failures.map(x => `- **${x.item.id}** (label ${x.item.truth}; ${x.item.category}; decision ${x.decision}): ${x.item.rationale}`).join('\n') || 'No binary false positives or false negatives in this run.'}\n\nDo not tune to this set and then call it a blind evaluation. Review semantic context, assumptions and likely consequences before changing rules; confirm improvements with a separately reviewed holdout.\n`);
  console.log(report);
}
main().catch(() => { console.error('Evaluation failed; inspect configuration and retry.'); process.exitCode = 1; });

/** Reproducible development-set evaluation; no model or HTTP latency is measured. */
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { analyzeSuspiciousMessage } from '../lib/decision-engine';
import { EVALUATION_DATASET } from './dataset';

async function main() {
  const labels = ['MALICIOUS', 'BENIGN', 'AMBIGUOUS'] as const;
  const decisions = ['HIGH_RISK', 'VERIFICATION_RECOMMENDED', 'INSUFFICIENT_EVIDENCE'] as const;
  const table: Record<string, Record<string, number>> = {};
  for (const label of labels) table[label] = Object.fromEntries(decisions.map(d => [d, 0]));
  let elapsed = 0;
  const categories: Record<string, Record<string, number>> = {};
  for (const item of EVALUATION_DATASET) {
    // Adversarial is a test technique, not ground truth. Use the dataset's explicit label.
    const label = item.groundTruthLabel === 'SAFE' ? 'BENIGN' : item.groundTruthLabel;
    const start = performance.now();
    const result = await analyzeSuspiciousMessage(item.text, false);
    elapsed += performance.now() - start;
    table[label][result.riskLevel]++;
    const category = item.primaryCategory || 'unspecified';
    categories[category] ??= Object.fromEntries(decisions.map(d => [d, 0]));
    categories[category][result.riskLevel]++;
  }
  const tp = table.MALICIOUS.HIGH_RISK, fn = table.MALICIOUS.VERIFICATION_RECOMMENDED + table.MALICIOUS.INSUFFICIENT_EVIDENCE;
  const fp = table.BENIGN.HIGH_RISK, tn = table.BENIGN.VERIFICATION_RECOMMENDED + table.BENIGN.INSUFFICIENT_EVIDENCE;
  const ratio = (a: number, b: number) => b ? (100 * a / b).toFixed(1) + '%' : 'n/a';
  const precision = tp / (tp + fp || 1), recall = tp / (tp + fn || 1);
  const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  const report = `# Legacy development dataset: rules-only evaluation\n\nRun: ${new Date().toISOString()}; base commit: ${commit} (working tree may contain changes); Node ${process.version}; dataset: legacy 100 self-authored cases. No independent or representative validation. Cases overlap with development rules.\n\n## Ground truth × decision\n\n| Label | HIGH_RISK | VERIFICATION_RECOMMENDED | INSUFFICIENT_EVIDENCE |\n|---|---:|---:|---:|\n${labels.map(l => `| ${l} | ${decisions.map(d => table[l][d]).join(' | ')} |`).join('\n')}\n\nBinary exploratory metrics: HIGH_RISK is treated as positive; both other outcomes as negative, only for the benign/malicious subset. AMBIGUOUS is excluded. Verification is not a declaration of safety.\n\n- Precision: ${ratio(tp, tp + fp)}; recall: ${ratio(tp, tp + fn)}; F1: ${ratio(2 * precision * recall, precision + recall)}\n- False positive rate: ${ratio(fp, fp + tn)}; false negative rate: ${ratio(fn, tp + fn)}\n- Insufficient evidence (abstention): ${ratio(labels.reduce((n, l) => n + table[l].INSUFFICIENT_EVIDENCE, 0), EVALUATION_DATASET.length)}\n- Malicious cases with insufficient evidence (under-warning): ${table.MALICIOUS.INSUFFICIENT_EVIDENCE}\n- Mean in-process engine time: ${(elapsed / EVALUATION_DATASET.length).toFixed(3)} ms; this is not browser, HTTP or model latency. Model/API cost: not measured; no model called.\n- Safety action quality, AI-assisted mode and full browser workflow: not evaluated.\n\n## Category counts by decision\n\n| Dataset category | HIGH_RISK | VERIFICATION_RECOMMENDED | INSUFFICIENT_EVIDENCE |\n|---|---:|---:|---:|\n${Object.entries(categories).map(([c, row]) => `| ${c} | ${decisions.map(d => row[d]).join(' | ')} |`).join('\n')}\n\nThis synthetic, rule-aligned set cannot establish real-world effectiveness, resistance to prompt injection, or absence of false reassurance. The added regression tests are development tests, not a blind independent dataset.\n`;
  writeFileSync('docs/evaluation/legacy-rules-run.md', report);
  console.log(report);
}
main().catch(error => { console.error(error); process.exitCode = 1; });

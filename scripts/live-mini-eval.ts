/** Four synthetic development examples; each hybrid analysis makes a provider call. */
import { loadEnvConfig } from '@next/env';
import { analyzeSuspiciousMessage } from '../src/lib/decision-engine';
import { writeFileSync } from 'node:fs';
loadEnvConfig(process.cwd(), true);
const cases = [
  { id: 'family-scam', label: 'MALICIOUS', text: 'Ahoj mami, mám nové číslo. Pošli mi ihned 20000 Kč.' },
  { id: 'family-normal', label: 'BENIGN', text: 'Ahoj mami, jak se máš? Přijedu zítra na oběd.' },
  { id: 'bank-code', label: 'MALICIOUS', text: 'Jsem z banky. Pošlete mi svůj SMS kód pro ověření účtu.' },
  { id: 'ambiguous', label: 'AMBIGUOUS', text: 'Zavolejte mi prosím, potřebujeme něco vyřešit.' },
];
async function main() {
  const rows: string[] = [];
  for (const item of cases) {
    const rules = await analyzeSuspiciousMessage(item.text, false);
    const hybrid = await analyzeSuspiciousMessage(item.text, true);
    const ai = hybrid.semanticAnalysis;
    const aiOnly = hybrid.metadata.aiStatus !== 'SUCCESS' ? 'NOT_AVAILABLE' : ai!.riskSignals.some(s => s.severity === 'CRITICAL' || s.severity === 'HIGH') ? 'HIGH_RISK' : ai!.riskSignals.length ? 'VERIFICATION_RECOMMENDED' : 'INSUFFICIENT_EVIDENCE';
    rows.push(`| ${item.id} | ${item.label} | ${rules.riskLevel} | ${aiOnly} | ${hybrid.metadata.aiStatus === 'SUCCESS' ? hybrid.riskLevel : 'NOT_AVAILABLE'} | ${hybrid.metadata.aiStatus} | ${hybrid.metadata.processingTimeMs} | ${hybrid.metadata.rejectedAiEvidence ?? 'n/a'} |`);
    console.log(JSON.stringify({ id: item.id, aiStatus: hybrid.metadata.aiStatus, elapsedMs: hybrid.metadata.processingTimeMs }));
  }
  const report = `# Live synthetic mini-evaluation\n\nRun: ${new Date().toISOString()}. Four self-authored synthetic development cases, not independent, blinded or representative. Model: ${process.env.OPENAI_MODEL || 'default'}; configured service: local or approved gateway. Rules-only and hybrid use the same examples; AI-only is a research heuristic derived from the same model response, not a separate call. Unavailable model outcomes are not counted as hybrid or AI-only successes. This tiny sample cannot establish AI improvement or real-world performance.\n\n| Case | Working label | Rules | AI-only heuristic | Hybrid | Provider status | Hybrid ms | Rejected quotes |\n|---|---|---|---|---|---|---:|---:|\n${rows.join('\n')}\n\nModel interpretation, recommendation safety and actual cost were not independently reviewed. Response latency is in-process, not a network-wide performance benchmark.\n`;
  writeFileSync('docs/evaluation/live-mini-evaluation.md', report);
}
main().catch(() => { console.error('Mini evaluation failed'); process.exitCode = 1; });

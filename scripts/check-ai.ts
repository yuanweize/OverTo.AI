import { loadEnvConfig } from '@next/env';
import { runLlmAnalysisIfConfigured } from '../src/lib/llm-adapter';

loadEnvConfig(process.cwd(), true);
async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error('No API key configured in .env.local.');
    process.exitCode = 1;
    return;
  }
  const start = Date.now();
  // Synthetic text only. This makes one potentially billable provider call.
  const result = await runLlmAnalysisIfConfigured('Ahoj mami, mám nové číslo. Pošli mi peníze.');
  console.log(JSON.stringify({ status: result.status, reason: result.reason, model: result.model, elapsedMs: Date.now() - start, groundedSignals: result.analysis?.riskSignals.length, rejectedEvidence: result.rejectedEvidence }));
  if (result.status !== 'SUCCESS') process.exitCode = 1;
}
main().catch(() => { console.error('AI check failed.'); process.exitCode = 1; });

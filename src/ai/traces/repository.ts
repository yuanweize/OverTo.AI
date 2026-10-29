import type { Pool } from 'pg';
import type { AiStatus } from '@/lib/llm-adapter';
export interface AiTrace {
  id: string; provider: string; model: string | null;
  promptVersion: string; status: Exclude<AiStatus, 'NOT_REQUESTED'>;
  failureReason: string | null; durationMs: number; inputTokens: number | null;
  outputTokens: number | null; rejectedEvidence: number | null; estimatedCostUsd: number | null;
}
/** Deliberately has no message, prompt, key, account, IP or raw error columns. */
export class TraceRepository {
  constructor(private readonly pool: Pool) {}
  async record(trace: AiTrace): Promise<void> {
    await this.pool.query(`INSERT INTO ai_traces(id,provider,model,prompt_version,status,failure_reason,duration_ms,input_tokens,output_tokens,rejected_evidence,estimated_cost_usd)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [trace.id,trace.provider,trace.model,trace.promptVersion,trace.status,trace.failureReason,trace.durationMs,trace.inputTokens,trace.outputTokens,trace.rejectedEvidence,trace.estimatedCostUsd]);
  }
  async recent() {
    return (await this.pool.query('SELECT * FROM ai_traces ORDER BY created_at DESC LIMIT 100')).rows;
  }
  async summary() {
    return (await this.pool.query(`SELECT count(*)::integer AS requests,
      count(*) FILTER (WHERE status='SUCCESS')::integer AS successes,
      count(*) FILTER (WHERE status='FAILED')::integer AS failures,
      count(*) FILTER (WHERE status IN ('BLOCKED','UNAVAILABLE'))::integer AS unavailable,
      round(avg(duration_ms))::integer AS average_ms,
      sum(input_tokens) AS input_tokens, sum(output_tokens) AS output_tokens,
      count(*) FILTER (WHERE input_tokens IS NOT NULL AND output_tokens IS NOT NULL)::integer AS token_reports
      FROM ai_traces WHERE created_at >= now() - interval '24 hours'`)).rows[0];
  }
}

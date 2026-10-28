import { NextRequest, NextResponse } from 'next/server';
import { POST as analyze } from '@/app/api/analyze/route';
import { buildActionGraph } from '@/fraud-engine/action-graph';
import type { AnalysisResult } from '@/types/analyzer';
import { createHash } from 'node:crypto';

/** Non-persistent v1 wrapper around the existing, bounded and consent-gated endpoint. */
export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  let response: Response;
  let metered = false;
  if (authorization) {
    const { pool } = await import('@/auth/server');
    const { runLocalAnalysis } = await import('@/billing/local-analysis');
    const match = /^Bearer (ovt_test_[A-Za-z0-9_-]{43})$/.exec(authorization);
    if (!pool || !match) return NextResponse.json({ schemaVersion: '1.0', error: { code: 'INVALID_KEY', message: 'Neplatný klíč.' } }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    const hash = createHash('sha256').update(match[1]).digest('hex');
    const lookup = await pool.query<{ workspace_id: string; project_id: string }>("UPDATE local_api_keys SET last_used_at=now() WHERE key_hash=$1 AND revoked_at IS NULL AND expires_at > now() RETURNING workspace_id, project_id", [hash]);
    if (!lookup.rowCount) return NextResponse.json({ schemaVersion: '1.0', error: { code: 'INVALID_KEY', message: 'Neplatný nebo zrušený klíč.' } }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    response = await runLocalAnalysis(request, lookup.rows[0].workspace_id, lookup.rows[0].project_id);
    metered = true;
  } else response = await analyze(request);
  if (!response.ok) {
    const body = await response.json();
    return NextResponse.json({ schemaVersion: '1.0', error: { code: 'ANALYSIS_REQUEST_FAILED', message: body.error } }, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  }
  const payload = await response.json();
  const result: AnalysisResult = metered ? payload.result : payload;
  const graph = buildActionGraph(result);
  return NextResponse.json({
    schemaVersion: '1.0', analysisId: crypto.randomUUID(), status: 'COMPLETED',
    decision: result.riskLevel, signals: result.evidences,
    evidence: graph.nodes.filter(node => node.kind === 'EVIDENCE'),
    actionGraph: graph, recommendedActions: result.recommendedActions,
    uncertainty: result.uncertaintyNotice,
    engine: { mode: result.metadata.engine, providerStatus: result.metadata.aiStatus, model: result.metadata.aiModel ?? null },
    metadata: { engineVersion: '0.1.0', rulesetVersion: 'development', decisionPolicyVersion: '1' , processingTimeMs: result.metadata.processingTimeMs, analyzedAt: result.metadata.analyzedAt, ...(metered ? { testCreditsCharged: payload.creditsCharged } : {}) },
    result,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

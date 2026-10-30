import { NextRequest, NextResponse } from 'next/server';
import { POST as analyze } from '@/app/api/analyze/route';
import { buildActionGraph } from '@/fraud-engine/action-graph';
import type { AnalysisResult } from '@/types/analyzer';
import { createHash } from 'node:crypto';
import { SharedRateLimiter } from '@/server/security/shared-rate-limit';
import { apiEntryLimiter } from '@/lib/process-limiter';

/** Non-persistent v1 wrapper around the existing, bounded and consent-gated endpoint. */
export async function POST(request: NextRequest) {
  const permit = apiEntryLimiter.acquire();
  if ('retryAfter' in permit) return NextResponse.json({ schemaVersion: '1.0', error: { code: 'RATE_LIMITED', message: 'Server je dočasně vytížen.' } }, { status: 429, headers: { 'Retry-After': String(permit.retryAfter), 'Cache-Control': 'no-store' } });
  try {
  const authorization = request.headers.get('authorization');
  let response: Response;
  let metered = false;
  if (authorization) {
    const { pool } = await import('@/auth/server');
    const { runLocalAnalysis } = await import('@/billing/local-analysis');
    const match = /^Bearer (ovt_test_[A-Za-z0-9_-]{43})$/.exec(authorization);
    if (!pool || !match) return NextResponse.json({ schemaVersion: '1.0', error: { code: 'INVALID_KEY', message: 'Neplatný klíč.' } }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    const hash = createHash('sha256').update(match[1]).digest('hex');
    const lookup = await pool.query<{ workspace_id: string; project_id: string; scopes:string[]; daily_request_limit:number; quota_id:string }>(`UPDATE local_api_keys k SET last_used_at=now() FROM local_workspaces w JOIN "user" u ON u.id=w.user_id JOIN local_projects p ON p.workspace_id=w.id WHERE k.project_id=p.id AND p.archived_at IS NULL AND k.workspace_id=w.id AND u."emailVerified"=true AND k.key_hash=$1 AND k.revoked_at IS NULL AND k.expires_at > now() RETURNING k.workspace_id, k.project_id,k.scopes,k.daily_request_limit,k.quota_id`, [hash]);
    if (!lookup.rowCount) return NextResponse.json({ schemaVersion: '1.0', error: { code: 'INVALID_KEY', message: 'Neplatný nebo zrušený klíč.' } }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    try {
      const admission = await new SharedRateLimiter(pool).consume([{ bucket: `key:${hash}`, limit: 30, windowSeconds: 60 },{bucket:`key-day:${lookup.rows[0].quota_id}`,limit:lookup.rows[0].daily_request_limit,windowSeconds:86400}]);
      if (!admission.allowed) return NextResponse.json({ schemaVersion: '1.0', error: { code: 'RATE_LIMITED', message: 'API key request limit reached.' } }, { status: 429, headers: { 'Retry-After': String(admission.retryAfter), 'Cache-Control': 'no-store' } });
    } catch { return NextResponse.json({ schemaVersion: '1.0', error: { code: 'RATE_LIMIT_UNAVAILABLE', message: 'Request admission is unavailable.' } }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
    response = await runLocalAnalysis(request, lookup.rows[0].workspace_id, lookup.rows[0].project_id,lookup.rows[0].scopes);
    metered = true;
  } else response = await analyze(request);
  if (!response.ok) {
    const body = await response.json();
    const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) headers['Retry-After'] = retryAfter;
    return NextResponse.json({ schemaVersion: '1.0', error: { code: response.status === 429 ? 'RATE_LIMITED' : response.status === 503 ? 'RATE_LIMIT_UNAVAILABLE' : 'ANALYSIS_REQUEST_FAILED', message: body.error } }, { status: response.status, headers });
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
  } finally { permit.release(); }
}

import { NextRequest, NextResponse } from 'next/server';
import { POST as analyze } from '@/app/api/analyze/route';
import { buildActionGraph } from '@/fraud-engine/action-graph';
import type { AnalysisResult } from '@/types/analyzer';

/** Non-persistent v1 wrapper around the existing, bounded and consent-gated endpoint. */
export async function POST(request: NextRequest) {
  const response = await analyze(request);
  if (!response.ok) {
    const body = await response.json();
    return NextResponse.json({ schemaVersion: '1.0', error: { code: 'ANALYSIS_REQUEST_FAILED', message: body.error } }, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  }
  const result: AnalysisResult = await response.json();
  const graph = buildActionGraph(result);
  return NextResponse.json({
    schemaVersion: '1.0', analysisId: crypto.randomUUID(), status: 'COMPLETED',
    decision: result.riskLevel, signals: result.evidences,
    evidence: graph.nodes.filter(node => node.kind === 'EVIDENCE'),
    actionGraph: graph, recommendedActions: result.recommendedActions,
    uncertainty: result.uncertaintyNotice,
    engine: { mode: result.metadata.engine, providerStatus: result.metadata.aiStatus, model: result.metadata.aiModel ?? null },
    metadata: { engineVersion: '0.1.0', rulesetVersion: 'development', decisionPolicyVersion: '1' , processingTimeMs: result.metadata.processingTimeMs, analyzedAt: result.metadata.analyzedAt },
    result,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/auth/server';
import { CreditLedger } from '@/billing/credit-ledger';
import { POST as analyze } from '@/app/api/analyze/route';
import type { AnalysisResult } from '@/types/analyzer';
import { readRequestBody } from '@/lib/read-request-body';

/** Local-only metered analysis; the caller must authorize this workspace and project. */
export async function runLocalAnalysis(request: NextRequest, workspaceId: string, projectId: string) {
  const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!pool) return fail('Nedostupné.', 503);
  if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') return fail('Použijte Content-Type: application/json.', 415);
  const key = request.headers.get('idempotency-key') ?? '';
  if (!/^[a-f0-9-]{36}$/i.test(key)) return fail('Chybí identifikátor požadavku.', 400);
  let raw: string;
  try { raw = new TextDecoder().decode(await readRequestBody(request, 40000)); }
  catch (error) {
    const code = error instanceof Error ? error.message : '';
    return fail(code === 'BODY_TOO_LARGE' ? 'Požadavek je příliš velký.' : code === 'BODY_TIMEOUT' ? 'Čas na odeslání požadavku vypršel.' : 'Chybí údaje.', code === 'BODY_TOO_LARGE' ? 413 : code === 'BODY_TIMEOUT' ? 408 : 400);
  }
  let body: { text?: unknown; enableLlm?: unknown; aiConsent?: unknown };
  try { body = JSON.parse(raw); } catch { return fail('Neplatný JSON.', 400); }
  if (!body || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 10000 || typeof body.enableLlm !== 'boolean' || (body.enableLlm && body.aiConsent !== true)) return fail('Zkontrolujte text a souhlas s AI.', 400);
  const ledger = new CreditLedger(pool);
  let reservation;
  try { reservation = await ledger.reserve(workspaceId, key, 1, 120); }
  catch (error) { if (error instanceof Error && error.message === 'INSUFFICIENT_CREDITS') return fail('Nemáte dostatek testovacích kreditů.', 402); return fail('Kredit nelze rezervovat.', 500); }
  if (!reservation.created) return fail('Tento požadavek již byl zpracován nebo probíhá. Použijte nový požadavek.', 409);
  const mode = body.enableLlm ? 'AI' : 'RULES';
  const started = Date.now();
  try {
    const internal = new NextRequest(new URL('/api/analyze', request.url), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw });
    const resultResponse = await analyze(internal);
    if (resultResponse.status === 429) {
      await ledger.settle(workspaceId, key, 0, { projectId, mode, providerStatus: 'FAILED', model: null, durationMs: Math.max(0, Date.now() - started) });
      return NextResponse.json({ error: 'Server je dočasně vytížen. Zkuste to prosím později.' }, { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': resultResponse.headers.get('retry-after') || '1' } });
    }
    if (!resultResponse.ok) throw new Error('ANALYSIS_FAILED');
    const result: AnalysisResult = await resultResponse.json();
    const credits = mode === 'AI' && result.metadata.aiStatus !== 'SUCCESS' ? 0 : 1;
    await ledger.settle(workspaceId, key, credits, { projectId, mode, providerStatus: result.metadata.aiStatus, model: result.metadata.aiModel ?? null, durationMs: Math.max(0, Date.now() - started) });
    return NextResponse.json({ result, creditsCharged: credits }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    try { await ledger.settle(workspaceId, key, 0, { projectId, mode, providerStatus: 'FAILED', model: null, durationMs: Math.max(0, Date.now() - started) }); } catch { /* Reservation expires lazily if the database is unavailable. */ }
    return fail('Analýzu se nepodařilo dokončit. Stav testovacího kreditu zkontrolujte ve využití.', 500);
  }
}

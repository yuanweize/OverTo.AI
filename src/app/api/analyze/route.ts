/**
 * OvěřTo.AI - API Endpoint /api/analyze
 * POST: Přijímá text podezřelé zprávy a vrací strukturovanou analýzu.
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeSuspiciousMessage } from '@/lib/decision-engine';
import { analysisLimiter } from '@/lib/process-limiter';
import { readRequestBody } from '@/lib/read-request-body';


export async function POST(request: NextRequest) {
  const permit = analysisLimiter.acquire();
  if ('retryAfter' in permit) return NextResponse.json({ error: 'Server je dočasně vytížen. Zkuste to prosím později.' }, { status: 429, headers: { 'Retry-After': String(permit.retryAfter), 'Cache-Control': 'no-store' } });
  try {
    if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') return NextResponse.json({ error: 'Použijte Content-Type: application/json.' }, { status: 415, headers: { 'Cache-Control': 'no-store' } });
    // Bound the body while reading, including requests without Content-Length.
    let bytes: Uint8Array;
    try { bytes = await readRequestBody(request, 40000); }
    catch (error) {
      const code = error instanceof Error ? error.message : '';
      const status = code === 'BODY_TOO_LARGE' ? 413 : code === 'BODY_TIMEOUT' ? 408 : 400;
      return NextResponse.json({ error: status === 413 ? 'Požadavek je příliš velký.' : status === 408 ? 'Čas na odeslání požadavku vypršel.' : 'Chybí tělo požadavku.' }, { status, headers: { 'Cache-Control': 'no-store' } });
    }
    let body: { text?: unknown; enableLlm?: unknown; aiConsent?: unknown };
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return NextResponse.json({ error: 'Neplatný JSON.' }, { status: 400 });
    }

    if (!body || typeof body.text !== 'string' || body.text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Zadejte prosím text zprávy k analýze.' },
        { status: 400 }
      );
    }

    // Bezpečnostní limit na délku vstupu (max 10 000 znaků)
    if (body.text.length > 10000) {
      return NextResponse.json(
        { error: 'Text zprávy překračuje maximální povolenou délku 10 000 znaků.' },
        { status: 413 }
      );
    }

    if (body.enableLlm !== undefined && typeof body.enableLlm !== 'boolean') {
      return NextResponse.json({ error: 'Neplatný režim analýzy.' }, { status: 400 });
    }
    if (body.enableLlm === true && body.aiConsent !== true) {
      return NextResponse.json({ error: 'Pro analýzu pomocí AI je nutný souhlas s odesláním upraveného textu poskytovateli.' }, { status: 400 });
    }
    const result = await analyzeSuspiciousMessage(body.text, body.enableLlm === true);

    // Bezpečné logování metrik bez úniku osobních údajů uživatele
    console.log(`[ANALYZE] Result: ${result.riskLevel} (score: ${result.riskScore}), Rules: ${result.metadata.ruleMatches}, Redacted PII: ${result.redactedCount}, Duration: ${result.metadata.processingTimeMs}ms`);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch {
    console.error('[ANALYZE_ERROR] Analysis failed');
    return NextResponse.json(
      { error: 'Při analýze zprávy došlo k neočekávané chybě. Zkuste to prosím znovu.' },
      { status: 500 }
    );
  } finally { permit.release(); }
}

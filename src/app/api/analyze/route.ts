/**
 * OvěřTo.AI - API Endpoint /api/analyze
 * POST: Přijímá text podezřelé zprávy a vrací strukturovanou analýzu.
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeSuspiciousMessage } from '@/lib/decision-engine';


export async function POST(request: NextRequest) {
  try {
    // Bound the body while reading, including requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: 'Chybí tělo požadavku.' }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 40000) {
        await reader.cancel();
        return NextResponse.json({ error: 'Požadavek je příliš velký.' }, { status: 413 });
      }
      chunks.push(value);
    }
    let body: { text?: unknown; enableLlm?: unknown; aiConsent?: unknown };
    try {
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
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
  }
}

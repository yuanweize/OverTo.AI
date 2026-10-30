import { defaultProviderSettings } from '@/ai/providers-config';
import { defaultPrompt } from '@/ai/prompts/default';
/**
 * OvěřTo.AI - API Endpoint /api/analyze
 * POST: Přijímá text podezřelé zprávy a vrací strukturovanou analýzu.
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeSuspiciousMessage } from '@/lib/decision-engine';
import { analysisLimiter } from '@/lib/process-limiter';
import { resolveLocale } from '@/i18n/locale';
import { readRequestBody } from '@/lib/read-request-body';
import { SharedRateLimiter } from '@/server/security/shared-rate-limit';
import { accountDeployment } from '@/auth/deployment';
import { extractClientIdentifier } from '@/server/security/client-identity';
import { AiBudgetGuard } from '@/server/ai/budgets';


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
    let body: { text?: unknown; enableLlm?: unknown; aiConsent?: unknown; locale?: unknown };
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
    if (body.locale !== undefined && body.locale !== 'cs' && body.locale !== 'en') return NextResponse.json({ error: 'INVALID_LOCALE' }, { status: 400 });
    // Public AI is restricted to the dedicated local deployment or configured self-host with active budget.
    const deployment = accountDeployment(process.env);
    let publicAiUnavailable = body.enableLlm === true && deployment?.mode !== 'local' && deployment?.mode !== 'selfhost';
    let admissionPool = null;

    if (deployment) {
      try {
        const { pool } = await import('@/auth/server');
        if (!pool) throw new Error('ADMISSION_DATABASE_UNAVAILABLE');
        admissionPool = pool;
        const clientId = extractClientIdentifier(request);
        const policies = [
          { bucket: 'public-rules-minute', limit: 90, windowSeconds: 60 },
          { bucket: 'public-rules-day', limit: 3000, windowSeconds: 86400 },
          { bucket: `client-rules-minute:${clientId}`, limit: 20, windowSeconds: 60 },
          { bucket: `client-rules-day:${clientId}`, limit: 200, windowSeconds: 86400 },
          ...(body.enableLlm === true ? [
            { bucket: 'public-ai-minute', limit: 4, windowSeconds: 60 },
            { bucket: 'public-ai-day', limit: 24, windowSeconds: 86400 },
            { bucket: `client-ai-minute:${clientId}`, limit: 2, windowSeconds: 60 },
            { bucket: `client-ai-day:${clientId}`, limit: 10, windowSeconds: 86400 },
          ] : []),
        ];
        const admission = await new SharedRateLimiter(pool).consume(policies);
        if (!admission.allowed) return NextResponse.json({ error: 'Denní nebo krátkodobý limit veřejné analýzy byl vyčerpán.' }, { status: 429, headers: { 'Retry-After': String(admission.retryAfter), 'Cache-Control': 'no-store' } });
      } catch {
        return NextResponse.json({ error: 'Ochrana veřejného API není dostupná.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
      }
    }

    const locale = resolveLocale(body.locale, request.headers.get('accept-language'));
    let prompt = defaultPrompt;
    let settings = defaultProviderSettings();
    if (publicAiUnavailable) settings = { ...settings, enabled: false };
    if (body.enableLlm === true && deployment && admissionPool) {
      const { PromptRepository } = await import('@/ai/prompts/repository');
      prompt = await new PromptRepository(admissionPool).active();
      const { ProviderRepository } = await import('@/ai/providers/repository');
      settings = (await new ProviderRepository(admissionPool).read()).config;
      if (publicAiUnavailable) settings = { ...settings, enabled: false };
    }

    // Atomic budget reservation before billable model invocation
    let reservationId: string | undefined;
    let budgetGuard: AiBudgetGuard | null = null;
    if (body.enableLlm === true && !publicAiUnavailable && deployment && admissionPool) {
      budgetGuard = new AiBudgetGuard(admissionPool);
      const reservation = await budgetGuard.reserve({
        provider: settings.providerName,
        model: settings.model,
        maxInputTokens: 3000,
        maxOutputTokens: settings.maxCompletionTokens,
      });

      if (!reservation.allowed) {
        publicAiUnavailable = true;
        settings = { ...settings, enabled: false };
      } else {
        reservationId = reservation.reservationId;
      }
    }

    const result = await analyzeSuspiciousMessage(body.text, body.enableLlm === true, locale, prompt, settings);

    if (result.metadata.aiStatus !== 'NOT_REQUESTED') {
      const traceId = crypto.randomUUID();
      result.metadata.traceId = traceId;
      result.metadata.traceRecorded = false;
      // Settle or release budget reservation
      let finalCost: number | null = null;
      if (budgetGuard && reservationId) {
        if (result.metadata.aiStatus === 'SUCCESS') {
          try {
            const { settledCost } = await budgetGuard.settle(reservationId, {
              inputTokens: result.metadata.inputTokens,
              outputTokens: result.metadata.outputTokens,
            });
            finalCost = settledCost;
          } catch {
            finalCost = null;
          }
        } else {
          await budgetGuard.release(reservationId).catch(() => {});
        }
      }

      // Optional observability. A storage failure must not discard the user's result.
      if (deployment && admissionPool) {
        try {
          const { TraceRepository } = await import('@/ai/traces/repository');
          await new TraceRepository(admissionPool).record({
            id: traceId,
            provider: settings.providerName,
            model: result.metadata.aiModel || settings.model,
            promptVersion: prompt.version,
            status: result.metadata.aiStatus,
            failureReason: result.metadata.aiReason || null,
            durationMs: result.metadata.providerDurationMs ?? result.metadata.processingTimeMs,
            inputTokens: result.metadata.inputTokens ?? null,
            outputTokens: result.metadata.outputTokens ?? null,
            rejectedEvidence: result.metadata.rejectedAiEvidence ?? null,
            estimatedCostUsd: finalCost,
          });
          result.metadata.traceRecorded = true;
        } catch {
          console.warn('[AI_TRACE] Metadata storage unavailable');
        }
      }
    }

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

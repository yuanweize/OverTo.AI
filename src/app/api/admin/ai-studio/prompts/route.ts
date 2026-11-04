import { ProviderRepository } from '@/ai/providers/repository';
import { pool } from '@/auth/server';
import { getPlatformAdmin } from '@/server/config/admin';
import { PromptRepository } from '@/ai/prompts/repository';
import { TraceRepository } from '@/ai/traces/repository';
import { providerInputTokenCeiling, runLlmAnalysisIfConfigured } from '@/lib/llm-adapter';
import { AiBudgetGuard } from '@/server/ai/budgets';
import { sanitizeInput } from '@/lib/sanitizer';
import { readRequestBody } from '@/lib/read-request-body';
import { SharedRateLimiter } from '@/server/security/shared-rate-limit';
import { isAllowedOrigin } from '@/server/security/origin';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request: Request) {
  if (!pool) return reply({error:'UNAVAILABLE'},503);
  if (!isAllowedOrigin(request.headers.get('origin'))) return reply({error:'INVALID_ORIGIN'},403);
  const user=await getPlatformAdmin(request.headers);
  if (!user) return reply({error:'FORBIDDEN'},403);
  try {
    const body=JSON.parse(new TextDecoder().decode(await readRequestBody(request,16000)));
    const repository=new PromptRepository(pool);
    const settings=(await new ProviderRepository(pool).read()).config;
    const model=settings.model;
    if (body.operation==='create') return reply({id:await repository.create(user.id,body.prompt)},201);
    if (body.operation==='activate') { await repository.activate(user.id,body.id,body.version,model); return reply({ok:true}); }
    if (body.operation==='test') {
      if (body.consent!==true || typeof body.text!=='string' || !body.text.trim() || body.text.length>4000) return reply({error:'CONSENT_AND_TEST_TEXT_REQUIRED'},400);
      if (process.env.AI_ENABLED !== 'true' || !process.env.OPENAI_API_KEY || !settings.enabled ||
          (process.env.NODE_ENV === 'production' && process.env.AI_PRODUCTION_ENABLED !== 'true')) return reply({error:'AI_UNAVAILABLE'},503);
      const permit=await new SharedRateLimiter(pool).consume([{bucket:`admin-prompt-test:${user.id}`,limit:5,windowSeconds:60}]);
      if (!permit.allowed) return reply({error:'RATE_LIMIT'},429);
      const prompt=await repository.get(body.id);
      const sanitized=sanitizeInput(body.text).sanitizedText;
      const maxInputTokens=providerInputTokenCeiling(sanitized,prompt,settings);
      if (maxInputTokens>100000) return reply({error:'INPUT_TOO_LARGE'},413);
      const guard=new AiBudgetGuard(pool);
      const reservation=await guard.reserve({provider:settings.providerName,model,maxInputTokens,maxOutputTokens:settings.maxCompletionTokens});
      if (!reservation.allowed || !reservation.reservationId) return reply({error:reservation.reason||'AI_BUDGET_BLOCKED'},409);
      const started=Date.now();
      const result=await runLlmAnalysisIfConfigured(sanitized,prompt,settings,{budgetReservationId:reservation.reservationId});
      const duration=Date.now()-started;
      let cost:number|null=null;
      if (result.requestDispatched) {
        try { cost=(await guard.settle(reservation.reservationId,{inputTokens:result.inputTokens,outputTokens:result.outputTokens})).settledCost; }
        catch { cost=null; }
      } else await guard.release(reservation.reservationId);
      const testId=await repository.recordTest(user.id,body.id,model,result,duration);
      const traceId=crypto.randomUUID();
      await new TraceRepository(pool).record({id:traceId,provider:settings.providerName,model:result.model||model,promptVersion:prompt.version,status:result.status==='NOT_REQUESTED'?'BLOCKED':result.status,failureReason:result.reason??null,durationMs:duration,inputTokens:result.inputTokens??null,outputTokens:result.outputTokens??null,rejectedEvidence:result.rejectedEvidence??null,estimatedCostUsd:cost});
      return reply({testId,traceId,durationMs:duration,...result});
    }
    return reply({error:'INVALID_OPERATION'},400);
  } catch(error) {
    const code=error instanceof Error?error.message:'';
    const known=['INVALID_PROMPT','NOT_FOUND','VERSION_CONFLICT','SUCCESSFUL_TEST_REQUIRED','INVALID_ACTIVATION','FORBIDDEN'];
    return reply({error:known.includes(code)?code:'OPERATION_FAILED'},code==='VERSION_CONFLICT'?409:code==='FORBIDDEN'?403:400);
  }
}

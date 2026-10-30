import {ProviderRepository} from '@/ai/providers/repository';
import { pool } from '@/auth/server';
import { getPlatformAdmin } from '@/server/config/admin';
import { readRequestBody } from '@/lib/read-request-body';
import { SharedRateLimiter } from '@/server/security/shared-rate-limit';
import { isAllowedOrigin } from '@/server/security/origin';
import { PromptRepository } from '@/ai/prompts/repository';
import { runEvaluation,summarizeEvaluation, type EvaluationMode } from '@/ai/evaluations/runner';
import { CHALLENGE_SET } from '@/evaluation/challenge-dataset';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request) {
  if(!pool)return reply({error:'UNAVAILABLE'},503);
  if(!isAllowedOrigin(request.headers.get('origin')))return reply({error:'INVALID_ORIGIN'},403);
  const user=await getPlatformAdmin(request.headers);if(!user)return reply({error:'FORBIDDEN'},403);
  let id:string|undefined;
  try {
    const body=JSON.parse(new TextDecoder().decode(await readRequestBody(request,1024)));
    const mode=body.mode as EvaluationMode;
    if(!['RULES_ONLY','LLM_ONLY','HYBRID_AI'].includes(mode)||mode!=='RULES_ONLY'&&body.consent!==true)return reply({error:'INVALID_MODE_OR_CONSENT'},400);
    const limit=mode==='RULES_ONLY'?CHALLENGE_SET.length:Math.min(4,CHALLENGE_SET.length);
    const permit=await new SharedRateLimiter(pool).consume([{bucket:'admin-evaluations',limit:1,windowSeconds:300}]);
    if(!permit.allowed)return Response.json({error:'RATE_LIMIT'},{status:429,headers:{'Retry-After':String(permit.retryAfter),'Cache-Control':'no-store'}});
    const prompt=await new PromptRepository(pool).active();id=crypto.randomUUID();
    const settings=(await new ProviderRepository(pool).read()).config;
    const model=mode==='RULES_ONLY'?null:settings.model;
    await pool.query("INSERT INTO ai_evaluation_runs(id,actor_id,mode,model,prompt_version,dataset_version,status,requested_cases) VALUES($1,$2,$3,$4,$5,'challenge-v1','RUNNING',$6)",[id,user.id,mode,model,prompt.version,limit]);
    const rows=await runEvaluation(mode,prompt,limit,settings),summary=summarizeEvaluation(rows);
    await pool.query("UPDATE ai_evaluation_runs SET rows=$1,summary=$2,status='COMPLETED',completed_at=now() WHERE id=$3",[JSON.stringify(rows),JSON.stringify(summary),id]);
    await pool.query('INSERT INTO ai_operations_audit(actor_id,action,target_id) VALUES($1,$2,$3)',[user.id,'EVALUATION_COMPLETED',id]);
    return reply({id,summary});
  } catch {
    if(id)await pool.query("UPDATE ai_evaluation_runs SET status='FAILED',completed_at=now() WHERE id=$1",[id]).catch(()=>{});
    return reply({error:'EVALUATION_FAILED'},503);
  }
}

import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { defaultPrompt, type RuntimePrompt } from './default';
import type { ProviderResult } from '@/lib/llm-adapter';
const uuid = (value: unknown): value is string => typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export class PromptRepository {
  constructor(private readonly pool: Pool) {}
  private async mutation<T>(actor: string, operation: (client: PoolClient)=>Promise<T>): Promise<T> {
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN');
      const allowed=await client.query('SELECT a.user_id FROM platform_admins a JOIN "user" u ON u.id=a.user_id WHERE a.user_id=$1 AND a.role=$2 AND u."emailVerified"=true FOR SHARE OF a,u',[actor,'ROOT']);
      if (!allowed.rowCount) throw new Error('FORBIDDEN');
      const result=await operation(client); await client.query('COMMIT'); return result;
    } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async list() {
    const [versions,activation,tests,audit]=await Promise.all([
      this.pool.query('SELECT * FROM ai_prompt_versions ORDER BY created_at DESC LIMIT 100'),
      this.pool.query('SELECT version,prompt_id,test_id FROM ai_prompt_activation WHERE id=1'),
      this.pool.query('SELECT id,prompt_id,model,status,duration_ms,input_tokens,output_tokens,failure_reason,grounded_signals,rejected_evidence,created_at FROM ai_prompt_tests ORDER BY created_at DESC LIMIT 30'),
      this.pool.query('SELECT action,target_id,details,created_at FROM ai_operations_audit ORDER BY created_at DESC LIMIT 30'),
    ]);
    return {versions:versions.rows,activation:activation.rows[0],tests:tests.rows,audit:audit.rows};
  }
  async get(id: string): Promise<RuntimePrompt> {
    if (!uuid(id)) throw new Error('INVALID_PROMPT');
    const result=await this.pool.query('SELECT id,instructions FROM ai_prompt_versions WHERE id=$1',[id]);
    if (!result.rowCount) throw new Error('NOT_FOUND');
    return {version:result.rows[0].id,instructions:result.rows[0].instructions};
  }
  async active(): Promise<RuntimePrompt> {
    const result=await this.pool.query('SELECT p.id,p.instructions FROM ai_prompt_activation a LEFT JOIN ai_prompt_versions p ON p.id=a.prompt_id WHERE a.id=1');
    if (!result.rowCount) throw new Error('PROMPTS_UNINITIALIZED');
    return result.rows[0].id ? {version:result.rows[0].id,instructions:result.rows[0].instructions} : defaultPrompt;
  }
  async create(actor: string,input: unknown) {
    if (!input || typeof input!=='object' || Array.isArray(input)) throw new Error('INVALID_PROMPT');
    const data=input as Record<string,unknown>;
    if (Object.keys(data).some(key=>!['name','instructions'].includes(key)) || typeof data.name!=='string' || !data.name.trim() || data.name.length>80 || typeof data.instructions!=='string' || data.instructions.trim().length<20 || data.instructions.length>4000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(data.instructions)) throw new Error('INVALID_PROMPT');
    const name=data.name.trim(), instructions=data.instructions.trim();
    return this.mutation(actor,async client=>{
      const id=randomUUID(),hash=createHash('sha256').update(instructions).digest('hex');
      await client.query('INSERT INTO ai_prompt_versions(id,name,instructions,content_hash,actor_id) VALUES($1,$2,$3,$4,$5)',[id,name,instructions,hash,actor]);
      await client.query('INSERT INTO ai_operations_audit(actor_id,action,target_id) VALUES($1,$2,$3)',[actor,'PROMPT_CREATED',id]);
      return id;
    });
  }
  async recordTest(actor: string,id: string,model: string,result: ProviderResult,duration: number) {
    if (!uuid(id) || result.status==='NOT_REQUESTED') throw new Error('INVALID_TEST');
    return this.mutation(actor,async client=>{
      const testId=randomUUID();
      await client.query('INSERT INTO ai_prompt_tests(id,prompt_id,actor_id,model,status,duration_ms,input_tokens,output_tokens,failure_reason,grounded_signals,rejected_evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[testId,id,actor,model,result.status,duration,result.inputTokens??null,result.outputTokens??null,result.reason??null,result.analysis?.riskSignals.length??null,result.rejectedEvidence??null]);
      await client.query('INSERT INTO ai_operations_audit(actor_id,action,target_id,details) VALUES($1,$2,$3,$4)',[actor,'PROMPT_TESTED',id,JSON.stringify({testId,status:result.status})]);
      return testId;
    });
  }
  async activate(actor: string,id: string|null,version: number,model: string) {
    if (id!==null && !uuid(id) || !Number.isSafeInteger(version) || version<0) throw new Error('INVALID_ACTIVATION');
    return this.mutation(actor,async client=>{
      const current=await client.query('SELECT version,prompt_id FROM ai_prompt_activation WHERE id=1 FOR UPDATE');
      if (current.rows[0]?.version!==version) throw new Error('VERSION_CONFLICT');
      let testId=null;
      if (id) {
        const tested=await client.query("SELECT id,status FROM ai_prompt_tests WHERE prompt_id=$1 AND model=$2 AND created_at>now()-interval '7 days' ORDER BY created_at DESC LIMIT 1",[id,model]);
        if (tested.rows[0]?.status!=='SUCCESS') throw new Error('SUCCESSFUL_TEST_REQUIRED');
        testId=tested.rows[0].id;
      }
      await client.query('UPDATE ai_prompt_activation SET version=version+1,prompt_id=$1,test_id=$2,updated_at=now() WHERE id=1',[id,testId]);
      await client.query('INSERT INTO ai_operations_audit(actor_id,action,target_id,details) VALUES($1,$2,$3,$4)',[actor,'PROMPT_ACTIVATED',id??defaultPrompt.version,JSON.stringify({before:current.rows[0].prompt_id,version:version+1,testId})]);
    });
  }
}

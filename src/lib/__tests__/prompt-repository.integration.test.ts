import { ProviderRepository } from '@/ai/providers/repository';
// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PromptRepository } from '@/ai/prompts/repository';
import { defaultPrompt } from '@/ai/prompts/default';
const connectionString=process.env.SITE_CONFIG_TEST_DATABASE_URL;
describe.skipIf(!connectionString)('immutable prompt versions and activation',()=>{
  const schema=`prompt_test_${randomUUID().replaceAll('-','')}`;
  const control=new Pool({connectionString});const pool=new Pool({connectionString,options:`-c search_path=${schema}`});
  const repository=new PromptRepository(pool);
  let id:string;
  beforeAll(async()=>{
    await control.query(`CREATE SCHEMA ${schema}`);
    await pool.query('CREATE TABLE "user"(id text PRIMARY KEY,"emailVerified" boolean)');
    await pool.query('INSERT INTO "user" VALUES ($1,true),($2,true)',['root','ordinary']);
    await pool.query(await readFile('migrations/007_platform_settings.sql','utf8'));
    await pool.query(await readFile('migrations/010_ai_prompts.sql','utf8'));
    await pool.query(await readFile('migrations/011_prompt_test_metrics.sql','utf8'));
    await pool.query(await readFile('migrations/013_ai_provider_settings.sql','utf8'));
    await pool.query("INSERT INTO platform_admins(user_id,role) VALUES('root','ROOT')");
  });
  afterAll(async()=>{await pool.end();await control.query(`DROP SCHEMA ${schema} CASCADE`);await control.end();});
  it('rejects ordinary users and malformed drafts before activation',async()=>{
    await expect(repository.create('ordinary',{name:'Test',instructions:defaultPrompt.instructions})).rejects.toThrow('FORBIDDEN');
    await expect(repository.create('root',{name:'Test',instructions:defaultPrompt.instructions,extra:true})).rejects.toThrow('INVALID_PROMPT');
    id=await repository.create('root',{name:'Synthetic test version',instructions:defaultPrompt.instructions});
    await expect(pool.query('UPDATE ai_prompt_versions SET name=$1 WHERE id=$2',['Changed',id])).rejects.toThrow('IMMUTABLE_PROMPT_VERSION');
    await expect(repository.activate('root',id,0,'synthetic-model')).rejects.toThrow('SUCCESSFUL_TEST_REQUIRED');
    expect(await repository.active()).toEqual(defaultPrompt);
  });
  it('requires the selected model and serializes competing activations with audit',async()=>{
    // Simulated provider result tests persistence only, not real model quality.
    await repository.recordTest('root',id,'synthetic-model',{status:'SUCCESS',inputTokens:10,outputTokens:20},40);
    await expect(repository.activate('root',id,0,'different-model')).rejects.toThrow('SUCCESSFUL_TEST_REQUIRED');
    const outcomes=await Promise.allSettled([repository.activate('root',id,0,'synthetic-model'),repository.activate('root',id,0,'synthetic-model')]);
    expect(outcomes.filter(x=>x.status==='fulfilled')).toHaveLength(1);
    expect((await repository.active()).version).toBe(id);
    const data=await repository.list();
    expect(data.activation.version).toBe(1);
    expect(data.audit.filter(row=>row.action==='PROMPT_ACTIVATED')).toHaveLength(1);
    for(const forbidden of ['text','prompt','key','ip'])expect(Object.keys(data.tests[0])).not.toContain(forbidden);
  });
  it('audits provider updates and rejects stale or unauthorized mutations',async()=>{
    const provider=new ProviderRepository(pool),snapshot=await provider.read();
    const config={...snapshot.config,model:'synthetic-model',allowedModels:['synthetic-model']};
    await expect(provider.update('ordinary',snapshot.version,config)).rejects.toThrow('FORBIDDEN');
    expect((await provider.update('root',snapshot.version,config)).version).toBe(snapshot.version+1);
    await expect(provider.update('root',snapshot.version,config)).rejects.toThrow('VERSION_CONFLICT');
    expect((await provider.read()).config.model).toBe('synthetic-model');
  });
  it('rejects a newer failed test, supports rollback and checks revoked verification',async()=>{
    await repository.recordTest('root',id,'synthetic-model',{status:'FAILED',reason:'timeout'},45);
    await expect(repository.activate('root',id,1,'synthetic-model')).rejects.toThrow('SUCCESSFUL_TEST_REQUIRED');
    await repository.activate('root',null,1,'synthetic-model');
    expect(await repository.active()).toEqual(defaultPrompt);
    await pool.query('UPDATE "user" SET "emailVerified"=false WHERE id=$1',['root']);
    await expect(repository.activate('root',null,2,'synthetic-model')).rejects.toThrow('FORBIDDEN');
  });
});

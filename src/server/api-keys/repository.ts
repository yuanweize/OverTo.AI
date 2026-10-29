import {createHash,randomBytes,randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
export type KeyScope='analysis:rules'|'analysis:ai';
export function validateKeyPolicy(input:Record<string,unknown>){
  const scopes=input.scopes??['analysis:rules'];const expiresDays=input.expiresDays??30;const dailyRequestLimit=input.dailyRequestLimit??1000;
  if(!Array.isArray(scopes)||scopes.length<1||scopes.length>2||new Set(scopes).size!==scopes.length||!scopes.every(x=>['analysis:rules','analysis:ai'].includes(x))||!Number.isInteger(expiresDays)||Number(expiresDays)<1||Number(expiresDays)>90||!Number.isInteger(dailyRequestLimit)||Number(dailyRequestLimit)<1||Number(dailyRequestLimit)>100000)throw Error('INVALID_KEY_POLICY');
  return {scopes:scopes as KeyScope[],expiresDays:Number(expiresDays),dailyRequestLimit:Number(dailyRequestLimit)};
}
export class ApiKeyRepository {
  constructor(private readonly pool:Pool){}
  async create(workspace:string,project:string,name:string,policy:ReturnType<typeof validateKeyPolicy>){
    const id=randomUUID(),key=`ovt_test_${randomBytes(32).toString('base64url')}`,hash=createHash('sha256').update(key).digest('hex');
    const result=await this.pool.query(`INSERT INTO local_api_keys(id,workspace_id,project_id,name,key_hash,key_prefix,expires_at,scopes,daily_request_limit,quota_id)
      SELECT $1,$2,p.id,$4,$5,$6,now()+$7*interval '1 day',$8,$9,$1 FROM local_projects p WHERE p.id=$3 AND p.workspace_id=$2 AND p.archived_at IS NULL RETURNING id,name,key_prefix,expires_at,scopes,daily_request_limit`,[id,workspace,project,name,hash,key.slice(0,15),policy.expiresDays,policy.scopes,policy.dailyRequestLimit]);
    if(!result.rowCount)throw Error('NOT_FOUND');return {key,metadata:result.rows[0]};
  }
  async rotate(workspace:string,id:string){
    const client=await this.pool.connect();try{
      await client.query('BEGIN');
      const old=await client.query(`SELECT k.* FROM local_api_keys k JOIN local_projects p ON p.id=k.project_id WHERE k.id=$1 AND k.workspace_id=$2 AND k.revoked_at IS NULL AND k.expires_at>now() AND p.archived_at IS NULL FOR UPDATE OF k`,[id,workspace]);
      if(!old.rowCount)throw Error('NOT_FOUND');
      const key=`ovt_test_${randomBytes(32).toString('base64url')}`,hash=createHash('sha256').update(key).digest('hex'),next=randomUUID(),previous=old.rows[0];
      await client.query('UPDATE local_api_keys SET revoked_at=now() WHERE id=$1',[id]);
      const saved=await client.query(`INSERT INTO local_api_keys(id,workspace_id,project_id,name,key_hash,key_prefix,expires_at,scopes,daily_request_limit,quota_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,name,key_prefix,expires_at,scopes,daily_request_limit`,[next,workspace,previous.project_id,previous.name,hash,key.slice(0,15),previous.expires_at,previous.scopes,previous.daily_request_limit,previous.quota_id]);
      await client.query('COMMIT');return {key,metadata:saved.rows[0]};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
}

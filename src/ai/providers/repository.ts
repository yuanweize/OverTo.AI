import type {Pool} from 'pg';
import {defaultProviderSettings,validateProviderSettings} from '../providers-config';
export class ProviderRepository {
  constructor(private readonly pool:Pool){}
  async read(){const result=await this.pool.query('SELECT version,config FROM ai_provider_settings WHERE id=1');if(!result.rowCount)throw Error('PROVIDER_UNINITIALIZED');return {version:result.rows[0].version as number,config:result.rows[0].config?validateProviderSettings(result.rows[0].config):defaultProviderSettings()};}
  async update(actor:string,version:number,input:unknown){
    const config=validateProviderSettings(input);if(!Number.isSafeInteger(version)||version<0)throw Error('INVALID_VERSION');
    const client=await this.pool.connect();try{
      await client.query('BEGIN');const admin=await client.query('SELECT a.user_id FROM platform_admins a JOIN "user" u ON u.id=a.user_id WHERE a.user_id=$1 AND a.role=$2 AND u."emailVerified"=true FOR SHARE OF a,u',[actor,'ROOT']);if(!admin.rowCount)throw Error('FORBIDDEN');
      const old=await client.query('SELECT version,config FROM ai_provider_settings WHERE id=1 FOR UPDATE');if(old.rows[0]?.version!==version)throw Error('VERSION_CONFLICT');
      await client.query('UPDATE ai_provider_settings SET version=version+1,config=$1,updated_at=now() WHERE id=1',[JSON.stringify(config)]);
      await client.query('INSERT INTO ai_operations_audit(actor_id,action,target_id,details) VALUES($1,$2,$3,$4)',[actor,'PROVIDER_CONFIG_UPDATED','compatible_api',JSON.stringify({version:version+1,before:old.rows[0].config,after:config})]);await client.query('COMMIT');return {version:version+1,config};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
}

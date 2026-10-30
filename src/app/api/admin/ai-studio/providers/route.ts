import {pool} from '@/auth/server';
import {getPlatformAdmin} from '@/server/config/admin';
import {ProviderRepository} from '@/ai/providers/repository';
import {readRequestBody} from '@/lib/read-request-body';
import {isAllowedOrigin} from '@/server/security/origin';
export async function PUT(request:Request){
  const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
  if(!pool)return reply({error:'UNAVAILABLE'},503);
  if(!isAllowedOrigin(request.headers.get('origin')))return reply({error:'INVALID_ORIGIN'},403);
  const user=await getPlatformAdmin(request.headers);if(!user)return reply({error:'FORBIDDEN'},403);
  try{const body=JSON.parse(new TextDecoder().decode(await readRequestBody(request,8000)));return reply(await new ProviderRepository(pool).update(user.id,body.version,body.config));}
  catch(error){const code=error instanceof Error?error.message:'';return reply({error:['VERSION_CONFLICT','INVALID_PROVIDER_CONFIG','INVALID_VERSION','FORBIDDEN'].includes(code)?code:'OPERATION_FAILED'},code==='VERSION_CONFLICT'?409:code==='FORBIDDEN'?403:400);}
}

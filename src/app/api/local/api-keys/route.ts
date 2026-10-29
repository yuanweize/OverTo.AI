import type {NextRequest} from 'next/server';
import {auth,pool} from '@/auth/server';
import {personalWorkspace} from '@/auth/workspace';
import {readRequestBody} from '@/lib/read-request-body';
import {ApiKeyRepository,validateKeyPolicy} from '@/server/api-keys/repository';
export async function POST(request:NextRequest){
  const reply=(data:unknown,status:number)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
  if(!auth||!pool||request.headers.get('origin')!==process.env.BETTER_AUTH_URL)return reply({error:'UNAVAILABLE'},403);
  const session=await auth.api.getSession({headers:request.headers});if(!session?.user.emailVerified)return reply({error:'UNAUTHORIZED'},401);
  try{
    const body=JSON.parse(new TextDecoder().decode(await readRequestBody(request,2048)));
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['name','projectId','scopes','expiresDays','dailyRequestLimit'].includes(k))||typeof body.name!=='string'||!body.name.trim()||body.name.length>80||typeof body.projectId!=='string'||body.projectId.length>100)return reply({error:'INVALID_INPUT'},400);
    const policy=validateKeyPolicy(body),{workspaceId}=await personalWorkspace(session.user.id);
    return reply(await new ApiKeyRepository(pool).create(workspaceId,body.projectId,body.name.trim(),policy),201);
  }catch(error){const code=error instanceof Error?error.message:'';return reply({error:code==='NOT_FOUND'?'PROJECT_NOT_FOUND':code==='BODY_TOO_LARGE'?'BODY_TOO_LARGE':'INVALID_INPUT'},code==='NOT_FOUND'?404:code==='BODY_TOO_LARGE'?413:400);}
}

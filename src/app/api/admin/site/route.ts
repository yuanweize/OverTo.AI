import { pool } from '@/auth/server';
import { getPlatformAdmin } from '@/server/config/admin';
import { SiteRepository } from '@/server/config/site-repository';
import { readRequestBody } from '@/lib/read-request-body';
import { isAllowedOrigin } from '@/server/security/origin';
export async function PUT(request: Request) {
  const fail = (error: string, status: number) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!pool) return fail('UNAVAILABLE', 503);
  if (!isAllowedOrigin(request.headers.get('origin'))) return fail('INVALID_ORIGIN', 403);
  const user = await getPlatformAdmin(request.headers);
  if (!user) return fail('FORBIDDEN', 403);
  try {
    const body = JSON.parse(new TextDecoder().decode(await readRequestBody(request, 16000)));
    const result = await new SiteRepository(pool).update(user.id, body.version, body.config);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    return fail(code === 'VERSION_CONFLICT' ? code : 'INVALID_CONFIG', code === 'VERSION_CONFLICT' ? 409 : 400);
  }
}

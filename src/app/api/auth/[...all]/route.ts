import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/auth/server';
import type { NextRequest } from 'next/server';
import { accountDeployment } from '@/auth/deployment';

function unavailable() { return Response.json({ error: 'Účty nejsou na tomto serveru dostupné.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
function allowedHost(request: NextRequest) {
  const deployment = accountDeployment(process.env);
  if (!deployment) return false;
  const host = request.headers.get('host');
  if (deployment.mode === 'local') return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname);
  return host === new URL(deployment.baseUrl).host;
}
export async function GET(request: NextRequest) { return auth && allowedHost(request) ? toNextJsHandler(auth).GET(request) : unavailable(); }
export async function POST(request: NextRequest) {
  if (!auth || !allowedHost(request)) return unavailable();
  if (request.nextUrl.pathname === '/api/auth/update-user') {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || !session.user.emailVerified) return Response.json({ error: 'Přihlaste se a ověřte e-mail.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  return toNextJsHandler(auth).POST(request);
}

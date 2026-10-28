import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/auth/server';
import type { NextRequest } from 'next/server';

function unavailable() { return Response.json({ error: 'Účty nejsou na tomto serveru dostupné.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
function local(request: NextRequest) { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname); }
export async function GET(request: NextRequest) { return auth && local(request) ? toNextJsHandler(auth).GET(request) : unavailable(); }
export async function POST(request: NextRequest) {
  if (!auth || !local(request)) return unavailable();
  if (request.nextUrl.pathname === '/api/auth/update-user') {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || !session.user.emailVerified) return Response.json({ error: 'Přihlaste se a ověřte e-mail.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  return toNextJsHandler(auth).POST(request);
}

import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/auth/server';
import type { NextRequest } from 'next/server';

function unavailable() { return Response.json({ error: 'Účty nejsou na tomto serveru dostupné.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
function local(request: NextRequest) { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname); }
export async function GET(request: NextRequest) { return auth && local(request) ? toNextJsHandler(auth).GET(request) : unavailable(); }
export async function POST(request: NextRequest) { return auth && local(request) ? toNextJsHandler(auth).POST(request) : unavailable(); }

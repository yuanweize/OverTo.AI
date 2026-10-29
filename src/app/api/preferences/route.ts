import { NextRequest, NextResponse } from 'next/server';
import { readRequestBody } from '@/lib/read-request-body';
export async function POST(request: NextRequest) {
  // Next may normalize the internal URL to localhost behind a proxy. Trust only
  // the operator's canonical origin, never a client-supplied forwarded host.
  const origin = new URL(process.env.OVERTO_PUBLIC_URL || process.env.BETTER_AUTH_URL || request.nextUrl.origin).origin;
  if (request.headers.get('origin') !== origin) return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  try {
    const body = JSON.parse(new TextDecoder().decode(await readRequestBody(request, 1024)));
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['locale', 'theme'].includes(key))) return NextResponse.json({ error: 'INVALID_PREFERENCE' }, { status: 400 });
    if ((body.locale !== undefined && !['cs', 'en', 'auto'].includes(body.locale)) || (body.theme !== undefined && !['light', 'dark', 'system'].includes(body.theme))) return NextResponse.json({ error: 'INVALID_PREFERENCE' }, { status: 400 });
    const response = NextResponse.json({ saved: true }, { headers: { 'Cache-Control': 'no-store' } });
    const options = { path: '/', sameSite: 'lax' as const, secure: origin.startsWith('https:'), httpOnly: true, maxAge: 31536000 };
    if (body.locale === 'auto') response.cookies.delete('overto-locale');
    else if (body.locale) response.cookies.set('overto-locale', body.locale, options);
    if (body.theme) response.cookies.set('overto-theme', body.theme, options);
    return response;
  } catch { return NextResponse.json({ error: 'INVALID_PREFERENCE' }, { status: 400 }); }
}

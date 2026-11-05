import { pool } from '@/auth/server';
import { getPlatformAdmin } from '@/server/config/admin';
import { grantAdminCredits } from '@/server/admin/credit-adjustment';
import { readRequestBody } from '@/lib/read-request-body';
import { isAllowedOrigin } from '@/server/security/origin';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  if (!pool) return Response.json({ error: 'UNAVAILABLE' }, { status: 503 });
  if (!isAllowedOrigin(request.headers.get('origin'))) {
    return Response.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  }

  const admin = await getPlatformAdmin(request.headers);
  if (!admin) return Response.json({ error: 'FORBIDDEN' }, { status: 403 });

  let body: { userId?: string; amount?: number; reason?: string };
  try {
    const raw = await readRequestBody(request, 4096);
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return Response.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  const { userId, amount, reason } = body;
  const requestId = request.headers.get('idempotency-key') ?? '';
  if (!userId || typeof userId !== 'string' || !Number.isSafeInteger(amount) || !amount || amount < 1 || amount > 10000 || typeof reason !== 'string' || !reason.trim() || reason.trim().length > 100 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return Response.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  try {
    const result = await grantAdminCredits(pool, { actorId: admin.id, userId, amount, reason, requestId });
    return Response.json({ success: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_WORKSPACE_NOT_FOUND') return Response.json({ error: error.message }, { status: 404 });
    if (error instanceof Error && error.message === 'FORBIDDEN') return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof Error && error.message === 'IDEMPOTENCY_CONFLICT') return Response.json({ error: error.message }, { status: 409 });
    return Response.json({ error: 'CREDIT_ADJUSTMENT_FAILED' }, { status: 500 });
  }
}

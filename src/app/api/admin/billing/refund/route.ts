import { pool } from '@/auth/server';
import { getPlatformAdmin } from '@/server/config/admin';
import { billingReconciliationStripe } from '@/billing/config';
import { submitBillingRefund } from '@/billing/admin-refund';
import { readRequestBody } from '@/lib/read-request-body';
import { isAllowedOrigin } from '@/server/security/origin';

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  if (!pool) return reply({ error: 'UNAVAILABLE' }, 503);
  if (!isAllowedOrigin(request.headers.get('origin'))) return reply({ error: 'INVALID_ORIGIN' }, 403);
  const admin = await getPlatformAdmin(request.headers);
  if (!admin) return reply({ error: 'FORBIDDEN' }, 403);
  let body: { targetId?: unknown; targetKind?: unknown; mode?: unknown; reason?: unknown };
  try { body = JSON.parse(new TextDecoder().decode(await readRequestBody(request, 1024))); }
  catch { return reply({ error: 'INVALID_INPUT' }, 400); }
  if (!body || typeof body !== 'object' || typeof body.targetId !== 'string' ||
      (body.targetKind !== 'order' && body.targetKind !== 'invoice') ||
      (body.mode !== 'test' && body.mode !== 'live') || typeof body.reason !== 'string')
    return reply({ error: 'INVALID_INPUT' }, 400);
  const stripe = billingReconciliationStripe(body.mode);
  if (!stripe) return reply({ error: 'STRIPE_UNAVAILABLE' }, 503);
  try {
    return reply(await submitBillingRefund(pool, stripe, { actorId: admin.id, targetId: body.targetId, targetKind: body.targetKind, mode: body.mode, reason: body.reason }));
  } catch (error) {
    const code = error instanceof Error ? error.message : 'REFUND_UNAVAILABLE';
    if (['INVALID_INPUT', 'ORDER_NOT_REFUNDABLE', 'PAYMENT_MISMATCH', 'ALREADY_REFUNDED'].includes(code)) return reply({ error: code }, 409);
    if (code === 'FORBIDDEN') return reply({ error: code }, 403);
    console.error('ADMIN_REFUND_ERROR', error);
    return reply({ error: 'REFUND_UNAVAILABLE' }, 503);
  }
}

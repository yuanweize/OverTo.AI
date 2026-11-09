import { auth, pool } from '@/auth/server';
import { personalWorkspace } from '@/auth/workspace';
import { BillingCheckout } from '@/billing/checkout';
import { billingConfig } from '@/billing/config';
import { readRequestBody } from '@/lib/read-request-body';
import { isAllowedOrigin } from '@/server/security/origin';
import { SharedRateLimiter } from '@/server/security/shared-rate-limit';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const config = billingConfig();
  if (!config?.checkoutEnabled || !auth || !pool) return Response.json({ error: 'BILLING_UNAVAILABLE' }, { status: 503 });
  if (!isAllowedOrigin(request.headers.get('origin'), config.publicOrigin)) return Response.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.emailVerified) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  let planVersionId: string;
  try {
    const data = JSON.parse(new TextDecoder().decode(await readRequestBody(request, 2048)));
    if (!data || typeof data.planVersionId !== 'string') throw new Error('INVALID_REQUEST');
    planVersionId = data.planVersionId;
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    return Response.json({ error: code === 'BODY_TOO_LARGE' ? 'BODY_TOO_LARGE' : 'INVALID_REQUEST' }, { status: code === 'BODY_TOO_LARGE' ? 413 : 400 });
  }
  try {
    const { workspaceId } = await personalWorkspace(session.user.id);
    const limit = await new SharedRateLimiter(pool).consume([{ bucket: `billing-checkout:${workspaceId}`, limit: 20, windowSeconds: 3600 }]);
    if (!limit.allowed) return Response.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } });
    const checkout = new BillingCheckout(pool, config.stripe, config.mode, config.publicOrigin, process.env.OVERTO_STRIPE_AUTOMATIC_TAX === 'true');
    const result = await checkout.create(workspaceId, planVersionId, request.headers.get('idempotency-key') ?? '');
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const status = ['INVALID_REQUEST', 'PLAN_UNAVAILABLE'].includes(code) ? 400
      : ['IDEMPOTENCY_CONFLICT', 'CHECKOUT_IN_PROGRESS', 'SUBSCRIPTION_EXISTS', 'CHECKOUT_EXPIRED'].includes(code) ? 409
      : ['PRICE_UNAVAILABLE', 'PRICE_MISMATCH'].includes(code) ? 503 : 502;
    return Response.json({ error: status === 502 ? 'CHECKOUT_FAILED' : code }, { status });
  }
}

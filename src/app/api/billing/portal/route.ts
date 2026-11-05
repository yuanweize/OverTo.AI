import { auth, pool } from '@/auth/server';
import { personalWorkspace } from '@/auth/workspace';
import { billingConfig } from '@/billing/config';
import { isAllowedOrigin } from '@/server/security/origin';
import { SharedRateLimiter } from '@/server/security/shared-rate-limit';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const config = billingConfig();
  if (!config || !auth || !pool) return Response.json({ error: 'BILLING_UNAVAILABLE' }, { status: 503 });
  if (!isAllowedOrigin(request.headers.get('origin'), config.publicOrigin)) return Response.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.emailVerified) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  try {
    const { workspaceId } = await personalWorkspace(session.user.id);
    const limit = await new SharedRateLimiter(pool).consume([{ bucket: `billing-portal:${workspaceId}`, limit: 20, windowSeconds: 3600 }]);
    if (!limit.allowed) return Response.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } });
    const customer = await pool.query<{ stripe_customer_id: string }>('SELECT stripe_customer_id FROM billing_customers WHERE mode=$1 AND workspace_id=$2', [config.mode, workspaceId]);
    if (!customer.rowCount) return Response.json({ error: 'NO_BILLING_ACCOUNT' }, { status: 404 });
    const stripeCustomer = await config.stripe.customers.retrieve(customer.rows[0].stripe_customer_id);
    if (stripeCustomer.deleted || stripeCustomer.livemode !== (config.mode === 'live') || stripeCustomer.metadata.workspaceId !== workspaceId) throw new Error('CUSTOMER_MISMATCH');
    const portal = await config.stripe.billingPortal.sessions.create({ customer: stripeCustomer.id, return_url: `${config.publicOrigin}/dashboard/billing` });
    const url = new URL(portal.url);
    if (url.protocol !== 'https:' || url.hostname !== 'billing.stripe.com') throw new Error('INVALID_PORTAL');
    return Response.json({ url: portal.url }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'PORTAL_UNAVAILABLE' }, { status: 502 }); }
}

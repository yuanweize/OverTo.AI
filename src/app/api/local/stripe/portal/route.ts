import { NextRequest, NextResponse } from 'next/server';
import { auth, pool } from '@/auth/server';
import { personalWorkspace } from '@/auth/workspace';
import { stripeTestConfig } from '@/billing/stripe-test';

export async function POST(request: NextRequest) {
  const config = stripeTestConfig();
  if (!config || !auth || !pool || request.headers.get('origin') !== process.env.BETTER_AUTH_URL) return NextResponse.json({ error: 'Testovací fakturace není dostupná.' }, { status: 503 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !session.user.emailVerified) return NextResponse.json({ error: 'Přihlaste se.' }, { status: 401 });
  const { workspaceId } = await personalWorkspace(session.user.id);
  const customer = await pool.query<{ stripe_customer_id: string }>('SELECT stripe_customer_id FROM local_stripe_customers WHERE workspace_id=$1', [workspaceId]);
  if (!customer.rowCount) return NextResponse.json({ error: 'Zatím nemáte testovací předplatné.' }, { status: 404 });
  try {
    const portal = await config.stripe.billingPortal.sessions.create({ customer: customer.rows[0].stripe_customer_id, return_url: 'http://127.0.0.1:3005/dashboard/billing' });
    if (new URL(portal.url).hostname !== 'billing.stripe.com') throw new Error('INVALID_PORTAL');
    return NextResponse.json({ url: portal.url, mode: 'test' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Testovací fakturační portál se nepodařilo otevřít.' }, { status: 502 }); }
}

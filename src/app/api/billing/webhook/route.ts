import { pool } from '@/auth/server';
import { billingConfig } from '@/billing/config';
import { BillingEvents } from '@/billing/events';
import { readRequestBody } from '@/lib/read-request-body';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const config = billingConfig();
  if (!config || !pool) return Response.json({ error: 'BILLING_UNAVAILABLE' }, { status: 503 });
  const signature = request.headers.get('stripe-signature');
  if (!signature) return Response.json({ error: 'INVALID_SIGNATURE' }, { status: 400 });
  let raw: Uint8Array;
  try { raw = await readRequestBody(request, 262144); }
  catch { return Response.json({ error: 'INVALID_BODY' }, { status: 413 }); }
  let event;
  try { event = config.stripe.webhooks.constructEvent(Buffer.from(raw), signature, config.webhookSecret); }
  catch { return Response.json({ error: 'INVALID_SIGNATURE' }, { status: 400 }); }
  try {
    await new BillingEvents(pool, config.stripe, config.mode).process(event);
    return Response.json({ received: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'EVENT_PROCESSING_FAILED' }, { status: 500 });
  }
}

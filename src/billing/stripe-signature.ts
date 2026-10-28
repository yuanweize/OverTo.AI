import Stripe from 'stripe';

/** Validates the exact raw request and rejects live-mode events. */
export function verifyTestEvent(stripe: Stripe, raw: Buffer, signature: string, secret: string): Stripe.Event | null {
  try {
    const event = stripe.webhooks.constructEvent(raw, signature, secret);
    return event.livemode ? null : event;
  } catch { return null; }
}

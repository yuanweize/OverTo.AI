import { describe, expect, it } from 'vitest';
import Stripe from 'stripe';
import { verifyTestEvent } from '@/billing/stripe-signature';

const stripe = new Stripe('sk_test_synthetic_only');
const secret = 'whsec_synthetic_only';
function sign(payload: string) { return stripe.webhooks.generateTestHeaderString({ payload, secret }); }
describe('Stripe test webhook verification', () => {
  it('accepts an authentic signed test payload and rejects changes', () => {
    const payload = JSON.stringify({ id: 'evt_test', object: 'event', type: 'invoice.paid', livemode: false, data: { object: {} } });
    const signature = sign(payload);
    expect(verifyTestEvent(stripe, Buffer.from(payload), signature, secret)?.id).toBe('evt_test');
    expect(verifyTestEvent(stripe, Buffer.from(payload + ' '), signature, secret)).toBeNull();
    expect(verifyTestEvent(stripe, Buffer.from(payload), signature, 'whsec_wrong')).toBeNull();
  });
  it('rejects an authentic live-mode event', () => {
    const payload = JSON.stringify({ id: 'evt_live', object: 'event', type: 'invoice.paid', livemode: true, data: { object: {} } });
    expect(verifyTestEvent(stripe, Buffer.from(payload), sign(payload), secret)).toBeNull();
  });
});

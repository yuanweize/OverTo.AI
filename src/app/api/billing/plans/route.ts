import { pool } from '@/auth/server';
import { BillingCatalog } from '@/billing/catalog';
import { billingConfig } from '@/billing/config';

export async function GET() {
  if (!pool) return Response.json({ error: 'UNAVAILABLE' }, { status: 503 });
  try {
    const config = billingConfig();
    const plans = (await new BillingCatalog(pool).current()).map(plan => ({
      id: plan.id, code: plan.code, version: plan.version, kind: plan.kind,
      nameCs: plan.name_cs, nameEn: plan.name_en, descriptionCs: plan.description_cs, descriptionEn: plan.description_en,
      currency: plan.currency, amountMinor: plan.amount_minor,
      monthlyCredits: plan.monthly_credits, packCredits: plan.pack_credits,
      paymentConfigurationPresent: !!config?.checkoutEnabled && plan.is_purchasable && !!(config.mode === 'test' ? plan.stripe_test_price_id : plan.stripe_live_price_id),
    }));
    return Response.json({ mode: config?.mode ?? 'disabled', plans }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'UNAVAILABLE' }, { status: 503 }); }
}

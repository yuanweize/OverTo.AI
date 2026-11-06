import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ArrowRight, Check, FlaskConical } from 'lucide-react';
import { pool } from '@/auth/server';
import { BillingCatalog } from '@/billing/catalog';
import { billingConfig } from '@/billing/config';

export default async function PricingPage() {
  const [t, catalogT, locale] = await Promise.all([getTranslations('Public'), getTranslations('BillingCatalog'), getLocale()]);
  const catalog = pool ? await new BillingCatalog(pool).current().catch(() => []) : [];
  const billing = billingConfig();
  const paidPlans = catalog.filter(plan => plan.kind !== 'FREE');
  const hasCheckout = !!billing?.checkoutEnabled && paidPlans.some(plan => plan.is_purchasable && !!(billing.mode === 'test' ? plan.stripe_test_price_id : plan.stripe_live_price_id));
  return <div className="flex min-h-screen flex-col"><Header/><main id="main" className="pricing-page shell flex-1">
    <div className="pricing-intro"><p className="eyebrow">{t('pricing')}</p><h1>{t('pricingTitle')}</h1><p>{hasCheckout ? catalogT(billing!.mode === 'test' ? 'pricingIntroTest' : 'pricingIntroLive') : t('pricingIntro')}</p></div>
    <div className="pricing-grid"><section className="pricing-current"><div className="pricing-card-top"><span className="pricing-mark"><Check size={22} aria-hidden="true"/></span><span>{t('try')}</span></div><h2>{t('free')}</h2><p className="pricing-description">{t('freeText')}</p><ul>{[t('rules'),t('ai'),t('evidence')].map(item=><li key={item}><Check size={18} aria-hidden="true"/>{item}</li>)}</ul><Link href="/analyze" className="pricing-cta">{t('open')}<ArrowRight size={18} aria-hidden="true"/></Link></section>
      {paidPlans.length ? paidPlans.map(plan => { const purchasable = !!billing?.checkoutEnabled && plan.is_purchasable && !!(billing.mode === 'test' ? plan.stripe_test_price_id : plan.stripe_live_price_id); return <section key={plan.id} className="pricing-future"><div className="pricing-card-top"><span className="pricing-mark"><FlaskConical size={22} aria-hidden="true"/></span><span>{purchasable ? catalogT(billing?.mode === 'test' ? 'testMode' : 'available') : t('planned')}</span></div><h2>{locale === 'cs' ? plan.name_cs : plan.name_en}</h2><p className="pricing-unset">{new Intl.NumberFormat(locale === 'cs' ? 'cs-CZ' : 'en-GB', { style: 'currency', currency: plan.currency }).format(Number(plan.amount_minor) / 100)}</p><p className="pricing-description">{locale === 'cs' ? plan.description_cs : plan.description_en}</p><p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{plan.kind === 'MONTHLY' ? catalogT('monthlyAllowance', { credits: plan.monthly_credits }) : catalogT('packAllowance', { credits: plan.pack_credits })}</p>{purchasable ? <Link href="/dashboard/billing" className="pricing-link">{catalogT('choosePlan')}<ArrowRight size={18} aria-hidden="true"/></Link> : <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">{catalogT('checkoutUnavailable')}</p>}</section>; }) : <section className="pricing-future"><div className="pricing-card-top"><span className="pricing-mark"><FlaskConical size={22} aria-hidden="true"/></span><span>{t('planned')}</span></div><h2>{t('teams')}</h2><p className="pricing-unset">{t('price')}</p><p className="pricing-description">{t('plans')}</p><Link href="/developers" className="pricing-link">{t('developers')}<ArrowRight size={18} aria-hidden="true"/></Link></section>}
    </div></main><Footer/></div>;
}

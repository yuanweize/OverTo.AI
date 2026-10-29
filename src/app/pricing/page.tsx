import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ArrowRight, Check, FlaskConical } from 'lucide-react';

export default async function PricingPage() {
  const t = await getTranslations('Public');
  return <div className="flex min-h-screen flex-col"><Header/><main id="main" className="pricing-page shell flex-1"><div className="pricing-intro"><p className="eyebrow">{t('pricing')}</p><h1>{t('pricingTitle')}</h1><p>{t('pricingIntro')}</p></div><div className="pricing-grid"><section className="pricing-current"><div className="pricing-card-top"><span className="pricing-mark"><Check size={22} aria-hidden="true"/></span><span>{t('try')}</span></div><h2>{t('free')}</h2><p className="pricing-description">{t('freeText')}</p><ul>{[t('rules'),t('ai'),t('evidence')].map(item=><li key={item}><Check size={18} aria-hidden="true"/>{item}</li>)}</ul><Link href="/analyze" className="pricing-cta">{t('open')}<ArrowRight size={18} aria-hidden="true"/></Link></section><section className="pricing-future"><div className="pricing-card-top"><span className="pricing-mark"><FlaskConical size={22} aria-hidden="true"/></span><span>{t('planned')}</span></div><h2>{t('teams')}</h2><p className="pricing-unset">{t('price')}</p><p className="pricing-description">{t('plans')}</p><Link href="/developers" className="pricing-link">{t('developers')}<ArrowRight size={18} aria-hidden="true"/></Link></section></div></main><Footer/></div>;
}

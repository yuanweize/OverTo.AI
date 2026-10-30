import { useTranslations } from 'next-intl';
import React from 'react';
import { PhoneCall, WifiOff, ShieldAlert } from 'lucide-react';

export const EmergencyChecklist: React.FC = () => {
 const t = useTranslations('Guidance');
 return (
  <section id="sos-pomoc" className="border-t border-rose-200 bg-rose-50/70 py-12 sm:py-16">
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-rose-800">{t('emergencyLabel')}</p>
      <h2 className="mt-2 max-w-2xl text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{t('emergencyTitle')}</h2>
      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700">{t('emergencyIntro')}</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-rose-200 bg-white p-5"><PhoneCall className="h-5 w-5 text-rose-700" aria-hidden="true" /><h3 className="mt-3 font-bold text-slate-900">{t('bankTitle')}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{t('bankText')}</p></div>
        <div className="rounded-xl border border-rose-200 bg-white p-5"><WifiOff className="h-5 w-5 text-rose-700" aria-hidden="true" /><h3 className="mt-3 font-bold text-slate-900">{t('deviceTitle')}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{t('deviceText')}</p></div>
        <div className="rounded-xl border border-rose-200 bg-white p-5"><ShieldAlert className="h-5 w-5 text-rose-700" aria-hidden="true" /><h3 className="mt-3 font-bold text-slate-900">{t('messagesTitle')}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{t('messagesText')}</p></div>
      </div>
    </div>
  </section>
);
};

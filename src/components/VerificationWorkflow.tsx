'use client';

import { useTranslations } from 'next-intl';
import React, { useState } from 'react';
import { ScamCategory } from '@/types/analyzer';

type Situation = 'none' | 'link' | 'password' | 'otp' | 'transfer' | 'remote';

export function VerificationWorkflow({ categories }: { categories: ScamCategory[] }) {
  const t = useTranslations('Guidance');
const choices: { value: Situation; label: string }[] = [
  { value: 'none', label: t('none') },
  { value: 'link', label: t('link') },
  { value: 'password', label: t('password') },
  { value: 'otp', label: t('otp') },
  { value: 'transfer', label: t('transfer') },
  { value: 'remote', label: t('remote') },
];

const nextSteps: Record<Exclude<Situation, 'none'>, string[]> = {
  link: [t('link1'), t('link2')],
  password: [t('password1'), t('password2')],
  otp: [t('otp1'), t('otp2')],
  transfer: [t('transfer1'), t('transfer2')],
  remote: [t('remote1'), t('remote2')],
};


  const [situation, setSituation] = useState<Situation | null>(null);
  const [outcome, setOutcome] = useState<'pending' | 'confirmed' | 'unresolved'>('pending');
  const family = categories.includes('FAMILY_EMERGENCY');
  const parcel = categories.includes('PACKAGE_DELIVERY');
  const independentStep = family
    ? t('family')
    : parcel
      ? t('parcel')
      : t('independent');

  return (
    <section aria-labelledby="verification-title" className="mt-6 rounded-2xl border border-teal-200 bg-[#eef5f3] p-5 sm:p-8">
      <h3 id="verification-title" className="text-xl font-bold text-slate-900">{t('title')}</h3>
      <p className="mt-2 text-sm text-slate-700">{t('notice')}</p>
      <fieldset className="mt-5">
        <legend className="font-semibold text-slate-900">{t('situation')}</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {choices.map(choice => <label key={choice.value} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm ${situation === choice.value ? 'border-teal-700 bg-white text-teal-950' : 'border-slate-300 bg-white text-slate-800'}`}>
            <input type="radio" name="situation" value={choice.value} checked={situation === choice.value} onChange={() => { setSituation(choice.value); setOutcome('pending'); }} className="h-4 w-4 accent-teal-700" />{choice.label}
          </label>)}
        </div>
      </fieldset>
      {situation !== null && <div className="mt-5 border-l-4 border-teal-700 bg-white p-4" aria-live="polite">
        <h4 className="font-semibold text-slate-900">{t('next')}</h4>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
          {(situation === 'none' ? [t('pause'), independentStep] : nextSteps[situation]).map(step => <li key={step}>{step}</li>)}
        </ol>
      </div>}
      <fieldset className="mt-5">
        <legend className="font-semibold text-slate-900">{t('outcome')}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setOutcome('confirmed')} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">{t('confirmed')}</button>
          <button type="button" onClick={() => setOutcome('unresolved')} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">{t('unresolved')}</button>
        </div>
      </fieldset>
      <p aria-live="polite" className="mt-3 text-sm text-slate-700">{outcome === 'confirmed' ? t('confirmedNote') : outcome === 'unresolved' ? t('unresolvedNote') : t('pendingNote')}</p>
    </section>
  );
}

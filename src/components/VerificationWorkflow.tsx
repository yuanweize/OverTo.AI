'use client';

import React, { useState } from 'react';
import { ScamCategory } from '@/types/analyzer';

type Situation = 'none' | 'link' | 'password' | 'otp' | 'transfer' | 'remote';

const choices: { value: Situation; label: string }[] = [
  { value: 'none', label: 'Zatím jsem nic neudělal/a' },
  { value: 'link', label: 'Otevřel/a jsem odkaz' },
  { value: 'password', label: 'Zadal/a jsem heslo nebo údaje karty' },
  { value: 'otp', label: 'Sdělil/a jsem ověřovací kód' },
  { value: 'transfer', label: 'Odeslal/a jsem peníze' },
  { value: 'remote', label: 'Nainstaloval/a jsem vzdálený přístup' },
];

const nextSteps: Record<Exclude<Situation, 'none'>, string[]> = {
  link: ['Stránku zavřete a nic dalšího na ní nezadávejte.', 'Pokud jste zadali údaje nebo něco instalovali, vyberte odpovídající možnost níže.'],
  password: ['Z bezpečného zařízení změňte dotčené heslo a další účty se stejným heslem.', 'Pokud jste zadali bankovní údaje, kontaktujte svou banku číslem z karty nebo její aplikace.'],
  otp: ['Ihned kontaktujte svou banku známým číslem z karty nebo aplikace a řekněte jí, co se stalo.', 'Nepotvrzujte další výzvy ani nesdělujte další kódy.'],
  transfer: ['Ihned kontaktujte banku známým číslem z karty nebo aplikace a požádejte o prověření a případné zastavení platby.', 'Uchovejte komunikaci a zvažte oznámení policii.'],
  remote: ['Odpojte zařízení od internetu a požádejte důvěryhodného odborníka o kontrolu.', 'Kontaktujte banku z jiného důvěryhodného zařízení a informujte ji o možném přístupu.'],
};

export function VerificationWorkflow({ categories }: { categories: ScamCategory[] }) {
  const [situation, setSituation] = useState<Situation | null>(null);
  const [outcome, setOutcome] = useState<'pending' | 'confirmed' | 'unresolved'>('pending');
  const family = categories.includes('FAMILY_EMERGENCY');
  const parcel = categories.includes('PACKAGE_DELIVERY');
  const independentStep = family
    ? 'Zavolejte příbuznému na číslo, které jste znali už před touto zprávou.'
    : parcel
      ? 'Otevřete aplikaci dopravce nebo jeho adresu, kterou už znáte, a stav zásilky ověřte tam.'
      : 'Kontaktujte osobu nebo instituci přes dříve známý kontakt, aplikaci nebo adresu, kterou sami vyhledáte.';

  return (
    <section aria-labelledby="verification-title" className="border-t border-slate-200 bg-indigo-50/40 p-6 sm:p-8">
      <h3 id="verification-title" className="text-xl font-bold text-slate-900">Bezpečné ověření krok za krokem</h3>
      <p className="mt-2 text-sm text-slate-700">Tento průvodce nic neověřuje za vás. Nepoužívejte kontakty ani odkazy z podezřelé zprávy.</p>
      <fieldset className="mt-5">
        <legend className="font-semibold text-slate-900">Udělal/a jste již něco podle zprávy?</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {choices.map(choice => <label key={choice.value} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm ${situation === choice.value ? 'border-indigo-700 bg-white text-indigo-950' : 'border-slate-300 bg-white text-slate-800'}`}>
            <input type="radio" name="situation" value={choice.value} checked={situation === choice.value} onChange={() => { setSituation(choice.value); setOutcome('pending'); }} className="h-4 w-4 accent-indigo-700" />{choice.label}
          </label>)}
        </div>
      </fieldset>
      {situation !== null && <div className="mt-5 border-l-4 border-indigo-600 bg-white p-4" aria-live="polite">
        <h4 className="font-semibold text-slate-900">Co můžete udělat teď</h4>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
          {(situation === 'none' ? ['Zastavte se. Neodesílejte peníze, hesla ani kódy a neinstalujte software podle zprávy.', independentStep] : nextSteps[situation]).map(step => <li key={step}>{step}</li>)}
        </ol>
      </div>}
      <fieldset className="mt-5">
        <legend className="font-semibold text-slate-900">Jak dopadlo vaše nezávislé ověření?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setOutcome('confirmed')} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700">Podařilo se mi ověřit</button>
          <button type="button" onClick={() => setOutcome('unresolved')} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700">Nepodařilo se mi ověřit</button>
        </div>
      </fieldset>
      <p aria-live="polite" className="mt-3 text-sm text-slate-700">{outcome === 'confirmed' ? 'Postupujte podle toho, co jste zjistili přes důvěryhodný kanál. Tato aplikace výsledek ověření nevidí ani nepotvrzuje.' : outcome === 'unresolved' ? 'S požadovanou akcí počkejte a požádejte o pomoc důvěryhodnou osobu nebo kontaktujte instituci známým kanálem.' : 'Výsledek můžete zaznamenat zde; zůstává v tomto prohlížeči.'}</p>
    </section>
  );
}

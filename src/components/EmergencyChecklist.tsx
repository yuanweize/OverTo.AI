import React from 'react';
import { PhoneCall, WifiOff, ShieldAlert } from 'lucide-react';

export const EmergencyChecklist: React.FC = () => (
  <section id="sos-pomoc" className="border-t border-rose-200 bg-rose-50/70 py-12 sm:py-16">
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold text-rose-800">První pomoc</p>
      <h2 className="mt-2 max-w-2xl text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Už jste sdíleli údaje nebo poslali peníze?</h2>
      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700">Nečekejte. Následující kroky vám pomohou začít situaci řešit.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-rose-200 bg-white p-5"><PhoneCall className="h-5 w-5 text-rose-700" aria-hidden="true" /><h3 className="mt-3 font-bold text-slate-900">Kontaktujte banku</h3><p className="mt-2 text-sm leading-6 text-slate-600">Volejte číslo z karty nebo bankovní aplikace. Sdělte, co se stalo, a požádejte o pomoc.</p></div>
        <div className="rounded-xl border border-rose-200 bg-white p-5"><WifiOff className="h-5 w-5 text-rose-700" aria-hidden="true" /><h3 className="mt-3 font-bold text-slate-900">Odpojte zařízení</h3><p className="mt-2 text-sm leading-6 text-slate-600">Pokud jste instalovali vzdálený přístup, odpojte zařízení od internetu a požádejte o kontrolu.</p></div>
        <div className="rounded-xl border border-rose-200 bg-white p-5"><ShieldAlert className="h-5 w-5 text-rose-700" aria-hidden="true" /><h3 className="mt-3 font-bold text-slate-900">Uchovejte zprávy</h3><p className="mt-2 text-sm leading-6 text-slate-600">Ponechte si komunikaci a zvažte oznámení policii. V naléhavé situaci volejte 158.</p></div>
      </div>
    </div>
  </section>
);

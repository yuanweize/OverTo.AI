import React from 'react';
import { Eye, ScanSearch, Route } from 'lucide-react';

const steps = [
  { icon: Eye, title: 'Zkontrolujete text', body: 'Před odesláním můžete upravit text po pokusu o maskování citlivých údajů. Maskování nemusí zachytit vše.' },
  { icon: ScanSearch, title: 'Prohlédnete si signály', body: 'Pravidla a případně AI hledají možné varovné znaky. Mohou se mýlit a neověřují totožnost odesílatele.' },
  { icon: Route, title: 'Rozhodnete se, co dál', body: 'Dostanete praktické kroky k ověření přes kontakt, který znáte, nebo k řešení již provedené akce.' },
];
export const HowItWorks: React.FC = () => (
  <section id="jak-to-funguje" className="border-t border-slate-200 bg-white py-12 sm:py-16">
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Jak vám OvěřTo pomůže</h2>
      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">Výsledek je pomůcka pro rozhodování, nikoli potvrzení bezpečnosti zprávy.</p>
      <div className="mt-8 grid gap-7 sm:grid-cols-3">{steps.map(({ icon: Icon, title, body }) => <div key={title} className="border-t-2 border-teal-700 pt-4"><Icon className="h-5 w-5 text-teal-700" aria-hidden="true" /><h3 className="mt-3 font-bold text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{body}</p></div>)}</div>
    </div>
  </section>
);

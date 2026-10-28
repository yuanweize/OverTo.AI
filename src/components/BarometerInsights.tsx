import React from 'react';
import { ExternalLink } from 'lucide-react';

export const BarometerInsights: React.FC = () => (
  <section id="barometr" className="border-t border-slate-200 bg-white py-12">
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Proč se věnovat podvodům?</h2>
      <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-700">V Českém barometru obav z AI 2026 uvedlo <strong>77,5 % dotázaných</strong> obavy z podvodů usnadněných AI. Průzkum zahrnoval 1 407 dospělých; jeho výsledky nelze automaticky zobecnit na všechny obyvatele Česka.</p>
      <a href="https://asociace.ai/cesky-barometr-obav-z-ai-2026/" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-indigo-700 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700">Přečíst zdrojový report <ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
    </div>
  </section>
);

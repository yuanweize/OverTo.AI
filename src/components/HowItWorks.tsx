import React from 'react';
import { Lock, Cpu, ShieldCheck } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  return (
    <section id="jak-to-funguje" className="py-12 bg-white border-t border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
            Inženýrský přístup & Poctivost k limitům
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Proč nepředstíráme, že jsme „zázračný AI detektor“?
          </h2>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Mnoho komerčních nástrojů slibuje, že dokáže na 100 % poznat text napsaný AI. V praxi tím však vytvářejí <strong>falešnou jistotu</strong>. Pravidla hledají známé signály. Pokud provozovatel nakonfiguruje AI, můžete ji se souhlasem použít k analýze kontextu. Pokud AI není dostupná, zobrazíme pouze výsledek pravidel.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black mb-4">
              1
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-emerald-600" />
              <h3 className="text-base font-bold text-slate-900">
                Lokální ochrana soukromí
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Prohlížeč se pokusí maskovat některé citlivé údaje. Maskování není úplné; zkontrolujte a odstraňte další osobní údaje. Upravený text je odeslán serveru.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black mb-4">
              2
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-4 h-4 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">
                Deterministické bezpečnostní pojistky
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pravidla hledají některé známé signály. Mohou chybovat a neověřují skutečnou totožnost odesílatele ani obsah odkazu.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black mb-4">
              3
            </div>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <h3 className="text-base font-bold text-slate-900">
                Od detekce k nezávislému ověření
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Místo hádání binárního štítku dostanete konkrétní instrukce: jak zavolat do banky, jak ověřit zásilku na oficiálním webu a jak se vyhnout manipulaci.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

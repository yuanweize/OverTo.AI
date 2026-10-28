import React from 'react';
import { AlertCircle, PhoneCall, ShieldAlert, WifiOff, Key, LifeBuoy } from 'lucide-react';

export const EmergencyChecklist: React.FC = () => {
  return (
    <section id="sos-pomoc" className="py-12 bg-slate-50 border-t border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">
          <AlertCircle className="w-4 h-4" />
          <span>První pomoc pro oběti podvodu</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2">
          Co dělat, pokud jste již odeslali peníze nebo zadali heslo?
        </h2>
        <p className="text-sm text-slate-600 mb-8 max-w-2xl">
          Při napadení hrají roli minuty. Pokud máte podezření, že jste podvodníkovi předali přístup nebo údaje, postupujte v tomto pořadí:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-rose-200 shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
              <PhoneCall className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Krok 1</span>
            <h3 className="text-base font-bold text-slate-900 mt-1 mb-1.5">
              Okamžitě volejte svou banku
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Zavolejte na klientskou linku na zadní straně karty. Požádejte o zablokování karty, internetového bankovnictví a pokus o stopnutí odchozí platby.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <WifiOff className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Krok 2</span>
            <h3 className="text-base font-bold text-slate-900 mt-1 mb-1.5">
              Odpojte zařízení od sítě
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pokud jste instalovali AnyDesk nebo TeamViewer, vypněte Wi-Fi i mobilní data, aby útočník ztratil spojení s vaším zařízením, a program odinstalujte.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Krok 3</span>
            <h3 className="text-base font-bold text-slate-900 mt-1 mb-1.5">
              Nahlaste událost Policii ČR
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Kontaktujte linku 158 nebo místní oddělení. Nechte si všechny SMS, zprávy z WhatsAppu, čísla účtů a pořiďte snímky obrazovky jako důkazy.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Krok 4</span>
            <h3 className="text-base font-bold text-slate-900 mt-1 mb-1.5">
              Bezplatná krizová podpora
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pro seniory a rodiny je k dispozici bezplatná krizová linka Elpida (<strong>800 200 007</strong>) nebo Bílý kruh bezpečí pro oběti trestných činů (<strong>116 006</strong>).
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

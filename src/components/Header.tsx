import React from 'react';
import { ShieldCheck, Sparkles, ExternalLink, Award } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Logo a název */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center text-white shadow-md shadow-indigo-100">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-slate-900">
                OvěřTo<span className="text-indigo-600">.AI</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Sparkles className="w-3 h-3 text-emerald-600" /> Funkční MVP
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Bezpečný asistent pro ověření podezřelých zpráv a požadavků
            </p>
          </div>
        </div>

        {/* Informace o soutěži a navigace */}
        <div className="flex items-center gap-3 sm:gap-6 text-sm">
          <a
            href="#barometr"
            className="hidden md:inline-flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 font-medium transition-colors"
          >
            <span>Český barometr AI</span>
            <span className="px-1.5 py-0.5 text-xs bg-indigo-50 text-indigo-700 rounded-md font-bold">
              77,5 %
            </span>
          </a>

          <a
            href="#jak-to-funguje"
            className="hidden sm:inline-flex text-slate-600 hover:text-indigo-600 font-medium transition-colors"
          >
            Jak to funguje
          </a>

          <a
            href="#sos-pomoc"
            className="text-amber-700 hover:text-amber-800 font-semibold px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs sm:text-sm transition-colors"
          >
            SOS První pomoc
          </a>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200/80">
            <Award className="w-3.5 h-3.5 text-indigo-600" />
            <span>AI výzva pro Česko 2026</span>
          </div>
        </div>
      </div>
    </header>
  );
};

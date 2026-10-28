import React from 'react';
import { ShieldCheck, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => (
  <footer className="border-t border-slate-800 bg-slate-900 py-10 text-sm text-slate-300">
    <div className="mx-auto flex max-w-4xl flex-col justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
      <div>
        <div className="flex items-center gap-2 font-bold text-white"><ShieldCheck className="h-5 w-5" aria-hidden="true" />OvěřTo.AI</div>
        <p className="mt-2 max-w-md leading-relaxed">Prototyp pro orientaci v podezřelých zprávách. Výsledek nenahrazuje nezávislé ověření.</p>
      </div>
      <a href="https://mesic.ai/#soutez" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 self-start text-white underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">AI výzva pro Česko 2026 <ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
    </div>
  </footer>
);

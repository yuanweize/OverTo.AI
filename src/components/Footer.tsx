import React from 'react';
import { ShieldCheck, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => (
  <footer className="border-t border-slate-800 bg-slate-900 py-10 text-sm text-slate-300">
    <div className="mx-auto flex max-w-4xl flex-col justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
      <div>
        <div className="flex items-center gap-2 font-bold text-white"><ShieldCheck className="h-5 w-5" aria-hidden="true" />OvěřTo.AI</div>
        <p className="mt-2 max-w-md leading-relaxed">Prototyp pro orientaci v podezřelých zprávách. Výsledek nenahrazuje nezávislé ověření.</p>
      </div>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
      <a href="https://github.com/yuanweize/ai-vyzva-cesko-2026" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-white underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true"><path d="M12 .297a12 12 0 0 0-3.794 23.387c.6.11.82-.26.82-.577v-2.234c-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.776.418-1.305.762-1.606-2.665-.3-5.467-1.332-5.467-5.93 0-1.31.469-2.381 1.236-3.221-.124-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.3 1.23a11.5 11.5 0 0 1 6.008 0c2.29-1.552 3.296-1.23 3.296-1.23.653 1.653.242 2.873.119 3.176.77.84 1.235 1.911 1.235 3.22 0 4.61-2.807 5.625-5.48 5.922.43.37.823 1.102.823 2.222v3.293c0 .32.216.694.825.576A12 12 0 0 0 12 .297Z" /></svg>GitHub</a>
      <a href="https://mesic.ai/#soutez" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 self-start text-white underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">AI výzva pro Česko 2026 <ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
      </div>
    </div>
  </footer>
);

import React from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export const Header: React.FC = () => (
  <header className="border-b border-slate-200 bg-white">
    <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      <Link href="/#top" className="inline-flex min-h-11 items-center gap-2.5 rounded text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700" aria-label="OvěřTo.AI — na začátek">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-800 text-white"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span>
        <span className="text-xl font-bold tracking-tight">OvěřTo<span className="text-teal-700">.AI</span></span>
      </Link>
      <nav aria-label="Hlavní navigace" className="flex items-center gap-3 sm:gap-6">
        <Link href="/#jak-to-funguje" className="hidden min-h-11 items-center text-sm font-semibold text-slate-700 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 sm:inline-flex">Jak to funguje</Link>
        <Link href="/developers" className="hidden min-h-11 items-center text-sm font-semibold text-slate-700 hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 md:inline-flex">API</Link>
        <Link href="/#sos-pomoc" className="inline-flex min-h-11 items-center rounded-lg border border-rose-200 px-3 text-sm font-semibold text-rose-800 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700">Potřebuji pomoc</Link>
      </nav>
    </div>
  </header>
);

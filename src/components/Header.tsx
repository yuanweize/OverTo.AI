import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export function Header() {
  return <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-4 px-5">
    <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded font-bold text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-800 text-white"><ShieldCheck size={20} aria-hidden="true"/></span><span className="text-xl tracking-tight">OvěřTo<span className="text-teal-700">.AI</span></span></Link>
    <nav aria-label="Hlavní navigace" className="flex items-center gap-4 text-sm font-semibold"><Link href="/analyze" className="py-3 text-slate-700 hover:text-teal-800">Analýza</Link><Link href="/developers" className="hidden py-3 text-slate-700 hover:text-teal-800 sm:inline">API</Link><Link href="/pricing" className="hidden py-3 text-slate-700 hover:text-teal-800 sm:inline">Ceník</Link><Link href="/login" className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-slate-800 hover:bg-slate-50">Přihlásit se</Link></nav>
  </div></header>;
}

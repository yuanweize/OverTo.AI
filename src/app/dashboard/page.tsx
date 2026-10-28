import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/auth/server';
import { personalWorkspace } from '@/auth/workspace';

export const instant = false;
export default async function DashboardPage() {
  if (!auth) redirect('/login');
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !session.user.emailVerified) redirect('/login');
  const data = await personalWorkspace(session.user.id);
  return <><p className="text-sm font-semibold text-teal-800">Osobní prostor</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Vítejte, {session.user.name}.</h1><p className="mt-3 max-w-2xl leading-7 text-slate-700">Zde najdete svůj místní testovací prostor. Text zpráv se neukládá. Analýzy v tomto prostoru využívají testovací kredity.</p><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><section className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-sm font-semibold text-slate-600">Testovací kredity</h2><p className="mt-3 text-3xl font-bold text-slate-950">{data.balance.available}</p><p className="mt-2 text-sm leading-6 text-slate-600">Pouze místní test. Úspěšná analýza stojí jeden testovací kredit.</p></section><section className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-sm font-semibold text-slate-600">Projekty</h2><p className="mt-3 text-3xl font-bold text-slate-950">{data.projects.length}</p><Link href="/dashboard/projects" className="mt-2 inline-flex min-h-10 items-center text-sm font-semibold text-teal-800 underline">Zobrazit projekty</Link></section><section className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-sm font-semibold text-slate-600">Tarif</h2><p className="mt-3 text-xl font-bold text-slate-950">Místní test</p><p className="mt-2 text-sm leading-6 text-slate-600">Předplatné ani platby nejsou dostupné.</p></section></div><section className="mt-8 rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-bold">Začněte analýzou</h2><p className="mt-2 max-w-xl leading-7 text-slate-700">Vložte podezřelou zprávu a před odesláním zkontrolujte její upravený text.</p><Link href="/dashboard/analyze" className="mt-5 inline-flex min-h-12 items-center rounded-lg bg-teal-800 px-5 font-semibold text-white hover:bg-teal-900">Otevřít analýzu</Link></section></>;
}

import Link from 'next/link';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/auth/server';
import { LogoutButton } from '@/components/account/LogoutButton';

export const instant = false;
const nav = [['Přehled','/dashboard'],['Nová analýza','/dashboard/analyze'],['Historie','/dashboard/analyses'],['Projekty','/dashboard/projects'],['API klíče','/dashboard/api-keys'],['Playground','/dashboard/playground'],['Využití','/dashboard/usage'],['Fakturace','/dashboard/billing'],['Nastavení','/dashboard/settings']];
async function Protected({ children }: { children: React.ReactNode }) {
  if (!auth) redirect('/login');
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !session.user.emailVerified) redirect('/login');
  return <div className="min-h-screen bg-[#f6f8f7] md:grid md:grid-cols-[240px_1fr]"><aside className="border-b border-slate-200 bg-white p-5 md:min-h-screen md:border-b-0 md:border-r"><Link href="/" className="text-xl font-bold tracking-tight text-slate-950">OvěřTo<span className="text-teal-700">.AI</span></Link><p className="mt-5 text-xs font-semibold text-slate-600">OSOBNÍ PROSTOR · MÍSTNÍ TEST</p><nav aria-label="Pracovní prostor" className="mt-4 flex gap-2 overflow-x-auto pb-2 md:flex-col">{nav.map(([label,href])=><Link key={href} href={href} className="min-h-10 shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-900">{label}</Link>)}</nav><div className="mt-6 border-t border-slate-200 pt-4"><p className="truncate text-sm font-semibold text-slate-900">{session.user.name}</p><p className="truncate text-xs text-slate-600">{session.user.email}</p><LogoutButton/></div></aside><div><div className="border-b border-slate-200 bg-white px-6 py-4 text-sm text-slate-600">Pracovní prostor / Osobní prostor</div><main className="mx-auto max-w-6xl p-5 sm:p-8">{children}</main></div></div>;
}
export default function DashboardLayout({ children }: { children: React.ReactNode }) { return <Suspense fallback={<p className="p-8">Načítání pracovního prostoru…</p>}><Protected>{children}</Protected></Suspense>; }

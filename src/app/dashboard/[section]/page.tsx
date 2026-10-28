import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/auth/server';
import { personalWorkspace } from '@/auth/workspace';
import { CreateProject } from '@/components/account/CreateProject';
import { ProjectList } from '@/components/account/ProjectList';
import { ApiKeyManager } from '@/components/account/ApiKeyManager';
import { ApiPlayground } from '@/components/ApiPlayground';
export const instant = false;
const sections: Record<string, { title: string; description: string }> = {
  analyses: { title: 'Historie analýz', description: 'Ukládání výsledků zatím není dostupné. Současné analýzy se do historie nezapisují.' },
  'api-keys': { title: 'API klíče', description: 'Vytváření a zrušení klíčů pro místní testovací projekty.' },
  playground: { title: 'API Playground', description: 'Odešlete skutečný místní test v režimu pravidel pomocí svého testovacího API klíče.' },
  usage: { title: 'Využití', description: 'Poslední místní testovací analýzy a spotřeba kreditů. Text zprávy se neukládá.' },
  billing: { title: 'Fakturace', description: 'Předplatné, platební metody a nákupy kreditů zatím nejsou dostupné.' },
  settings: { title: 'Nastavení', description: 'Správa profilu a odstranění účtu se připravují.' },
  projects: { title: 'Projekty', description: 'Projekty v tomto místním osobním prostoru.' },
};
export default async function Section({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params; const page = sections[section]; if (!page) notFound();
  if (!auth) redirect('/login'); const session = await auth.api.getSession({ headers: await headers() }); if (!session || !session.user.emailVerified) redirect('/login');
  const workspace = await personalWorkspace(session.user.id);
  return <><p className="text-sm font-semibold text-teal-800">Osobní prostor</p><h1 className="mt-2 text-3xl font-bold text-slate-950">{page.title}</h1><p className="mt-3 max-w-2xl leading-7 text-slate-700">{page.description}</p><section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">{section === 'projects' ? <><ProjectList projects={workspace.projects.map(project => ({ id: project.id, name: project.name, archived: !!project.archived_at }))} defaultProjectId={workspace.defaultProjectId}/><CreateProject/></> : section === 'api-keys' ? <ApiKeyManager projects={workspace.projects.filter(project => !project.archived_at)} keys={workspace.keys.map(key => ({ ...key, expires_at: key.expires_at.toISOString(), revoked_at: key.revoked_at?.toISOString() ?? null }))}/> : section === 'playground' ? <ApiPlayground accountMode/> : section === 'usage' ? <><h2 className="font-semibold">Poslední požadavky</h2>{workspace.usage.length ? <ul className="mt-4 divide-y divide-slate-200">{workspace.usage.map((event, index) => <li key={index} className="py-4 text-sm text-slate-700">{event.mode === 'AI' ? 'AI' : 'Pravidla'} · {event.provider_status} · {event.credits} testovací kredit(y) · {event.project_name} · {new Date(event.created_at).toLocaleString('cs-CZ')}</li>)}</ul> : <p className="mt-3 text-sm text-slate-600">Zatím žádné analýzy.</p>}</> : <><h2 className="font-semibold">Zatím není dostupné</h2><p className="mt-2 text-sm leading-6 text-slate-600">Tuto funkci připravujeme; údaje a transakce se zde nezobrazují.</p><Link href="/dashboard" className="mt-4 inline-flex min-h-11 items-center font-semibold text-teal-800 underline">Zpět na přehled</Link></>}</section></>;
}

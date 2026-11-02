import { Suspense } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/auth/server';
import { accountDeployment } from '@/auth/deployment';
import { WorkspaceShell } from '@/components/account/WorkspaceShell';
import { getTranslations } from 'next-intl/server';

async function Protected({ children }: { children: React.ReactNode }) {
  if (!auth) redirect('/login');
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !session.user.emailVerified) redirect('/login');
  let mode: 'local' | 'selfhost' = 'selfhost';
  try {
    const deployment = accountDeployment(process.env);
    if (deployment) mode = deployment.mode;
  } catch {}
  return <WorkspaceShell name={session.user.name} email={session.user.email} mode={mode}>{children}</WorkspaceShell>;
}
export default async function DashboardLayout({ children }: { children: React.ReactNode }) { const t = await getTranslations('Dashboard'); return <Suspense fallback={<p className="p-8">{t('loading')}</p>}><Protected>{children}</Protected></Suspense>; }

import { Suspense } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/auth/server';
import { accountDeployment } from '@/auth/deployment';
import { getPlatformAdmin } from '@/server/config/admin';
import { WorkspaceShell } from '@/components/account/WorkspaceShell';
import { getTranslations } from 'next-intl/server';

async function Protected({ children }: { children: React.ReactNode }) {
  if (!auth) redirect('/login');
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session || !session.user.emailVerified) redirect('/login');
  const adminUser = await getPlatformAdmin(reqHeaders);
  const canAdmin = Boolean(adminUser);
  let mode: 'local' | 'selfhost' = 'selfhost';
  try {
    const deployment = accountDeployment(process.env);
    if (deployment) mode = deployment.mode;
  } catch {}
  return (
    <WorkspaceShell
      name={session.user.name}
      email={session.user.email}
      mode={mode}
      canAdmin={canAdmin}
    >
      {children}
    </WorkspaceShell>
  );
}
export default async function DashboardLayout({ children }: { children: React.ReactNode }) { const t = await getTranslations('Dashboard'); return <Suspense fallback={<p className="p-8">{t('loading')}</p>}><Protected>{children}</Protected></Suspense>; }

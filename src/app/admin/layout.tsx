import { headers } from 'next/headers';
import { getPlatformAdmin } from '@/server/config/admin';
import { accountDeployment } from '@/auth/deployment';
import { WorkspaceShell } from '@/components/account/WorkspaceShell';

export default async function AdminLayout({children}: {children:React.ReactNode}) {
  const user=await getPlatformAdmin(await headers());
  if (!user) return children;
  let mode: 'local' | 'selfhost' = 'selfhost';
  try {
    const deployment = accountDeployment(process.env);
    if (deployment) mode = deployment.mode;
  } catch {}
  return <WorkspaceShell name={user.name} email={user.email} admin canAdmin mode={mode}>{children}</WorkspaceShell>;
}

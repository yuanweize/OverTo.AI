import { headers } from 'next/headers';
import { getPlatformAdmin } from '@/server/config/admin';
import { WorkspaceShell } from '@/components/account/WorkspaceShell';
export default async function AdminLayout({children}: {children:React.ReactNode}) {
  const user=await getPlatformAdmin(await headers());
  if (!user) return children;
  return <WorkspaceShell name={user.name} email={user.email} admin>{children}</WorkspaceShell>;
}

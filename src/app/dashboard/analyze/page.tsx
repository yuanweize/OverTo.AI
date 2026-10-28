import { AnalysisWorkspace } from '@/components/AnalysisWorkspace';
import { auth } from '@/auth/server';
import { personalWorkspace } from '@/auth/workspace';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const instant = false;
export default async function DashboardAnalyzePage() {
  if (!auth) redirect('/login');
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !session.user.emailVerified) redirect('/login');
  const workspace = await personalWorkspace(session.user.id);
  return <AnalysisWorkspace accountMode projects={workspace.projects.filter(project => !project.archived_at).map(({ id, name }) => ({ id, name }))} defaultProjectId={workspace.defaultProjectId}/>;
}

import { NextRequest, NextResponse } from 'next/server';
import { auth, pool } from '@/auth/server';
import { personalWorkspace } from '@/auth/workspace';
import { runLocalAnalysis } from '@/billing/local-analysis';

export async function POST(request: NextRequest) {
  if (!auth || !pool || request.headers.get('origin') !== process.env.BETTER_AUTH_URL) return NextResponse.json({ error: 'Nedostupné.' }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !session.user.emailVerified) return NextResponse.json({ error: 'Přihlaste se.' }, { status: 401 });
  const { workspaceId, defaultProjectId } = await personalWorkspace(session.user.id);
  const projectId = request.headers.get('x-project-id') || defaultProjectId;
  if (projectId.length > 100) return NextResponse.json({ error: 'Projekt nebyl nalezen.' }, { status: 404 });
  const project = await pool.query('SELECT id FROM local_projects WHERE id=$1 AND workspace_id=$2 AND archived_at IS NULL', [projectId, workspaceId]);
  if (!project.rowCount) return NextResponse.json({ error: 'Projekt nebyl nalezen nebo je archivován.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return runLocalAnalysis(request, workspaceId, projectId);
}

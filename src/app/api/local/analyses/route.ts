import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth/server';
import { personalWorkspace } from '@/auth/workspace';
import { runLocalAnalysis } from '@/billing/local-analysis';

export async function POST(request: NextRequest) {
  if (!auth || request.headers.get('origin') !== process.env.BETTER_AUTH_URL) return NextResponse.json({ error: 'Nedostupné.' }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !session.user.emailVerified) return NextResponse.json({ error: 'Přihlaste se.' }, { status: 401 });
  const { workspaceId } = await personalWorkspace(session.user.id);
  return runLocalAnalysis(request, workspaceId, `default:${session.user.id}`);
}

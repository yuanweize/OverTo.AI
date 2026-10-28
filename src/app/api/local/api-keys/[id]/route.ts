import type { NextRequest } from 'next/server';
import { auth, pool } from '@/auth/server';
import { personalWorkspace } from '@/auth/workspace';
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!auth || !pool || request.headers.get('origin') !== process.env.BETTER_AUTH_URL) return Response.json({ error: 'Nedostupné.' }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers }); if (!session || !session.user.emailVerified) return Response.json({ error: 'Přihlaste se.' }, { status: 401 });
  const { workspaceId } = await personalWorkspace(session.user.id); const { id } = await params;
  const result = await pool.query('UPDATE local_api_keys SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1 AND workspace_id=$2 RETURNING id', [id, workspaceId]);
  if (!result.rowCount) return Response.json({ error: 'Klíč nebyl nalezen.' }, { status: 404 });
  return Response.json({ revoked: true }, { headers: { 'Cache-Control': 'no-store' } });
}

import type { NextRequest } from 'next/server';
import { auth, pool } from '@/auth/server';
import { personalWorkspace } from '@/auth/workspace';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const error = (message: string, status: number) => Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!auth || !pool || request.headers.get('origin') !== process.env.BETTER_AUTH_URL) return error('Nedostupné.', 403);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !session.user.emailVerified) return error('Přihlaste se.', 401);
  const reader = request.body?.getReader(); if (!reader) return error('Chybí údaje.', 400);
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 1024) { await reader.cancel(); return error('Příliš velký požadavek.', 413); } chunks.push(part.value); }
  let parsed: unknown; try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return error('Neplatné údaje.', 400); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return error('Neplatné údaje.', 400);
  const body = parsed as Record<string, unknown>; const fields = Object.keys(body);
  if (fields.length !== 1 || !['name', 'archived'].includes(fields[0])) return error('Neplatné údaje.', 400);
  const { id } = await params; if (id.length > 100) return error('Projekt nebyl nalezen.', 404);
  const { workspaceId, defaultProjectId } = await personalWorkspace(session.user.id);
  try {
    let result;
    if ('name' in body) {
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 80) return error('Název musí mít 1 až 80 znaků.', 400);
      result = await pool.query('UPDATE local_projects SET name=$1 WHERE id=$2 AND workspace_id=$3 RETURNING id,name,archived_at', [body.name.trim(), id, workspaceId]);
    } else {
      if (typeof body.archived !== 'boolean') return error('Neplatný stav projektu.', 400);
      if (id === defaultProjectId && body.archived) return error('Výchozí projekt nelze archivovat.', 409);
      result = await pool.query('UPDATE local_projects SET archived_at=CASE WHEN $1 THEN COALESCE(archived_at,now()) ELSE NULL END WHERE id=$2 AND workspace_id=$3 RETURNING id,name,archived_at', [body.archived, id, workspaceId]);
    }
    if (!result.rowCount) return error('Projekt nebyl nalezen.', 404);
    return Response.json({ project: result.rows[0] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (caught) {
    if (typeof caught === 'object' && caught !== null && 'code' in caught && caught.code === '23505') return error('Projekt s tímto názvem už existuje.', 409);
    return error('Projekt se nepodařilo upravit.', 500);
  }
}

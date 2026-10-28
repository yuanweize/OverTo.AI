import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { auth, pool } from '@/auth/server';
import { personalWorkspace } from '@/auth/workspace';

export async function POST(request: NextRequest) {
  if (!auth || !pool || request.headers.get('origin') !== process.env.BETTER_AUTH_URL) return Response.json({ error: 'Nedostupné.' }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers }); if (!session) return Response.json({ error: 'Přihlaste se.' }, { status: 401 });
  if (Number(request.headers.get('content-length') || '0') > 1024) return Response.json({ error: 'Příliš velký požadavek.' }, { status: 413 });
  const reader = request.body?.getReader(); if (!reader) return Response.json({ error: 'Chybí údaje.' }, { status: 400 });
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 1024) { await reader.cancel(); return Response.json({ error: 'Příliš velký požadavek.' }, { status: 413 }); } chunks.push(part.value); }
  let data: unknown; try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return Response.json({ error: 'Neplatné údaje.' }, { status: 400 }); }
  const body = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
  const name = typeof body.name === 'string' ? body.name.trim() : ''; const projectId = typeof body.projectId === 'string' ? body.projectId : '';
  if (!name || name.length > 80 || projectId.length > 100) return Response.json({ error: 'Zkontrolujte název a projekt.' }, { status: 400 });
  const { workspaceId } = await personalWorkspace(session.user.id);
  const key = `ovt_test_${randomBytes(32).toString('base64url')}`; const hash = createHash('sha256').update(key).digest('hex');
  const result = await pool.query(`INSERT INTO local_api_keys (id,workspace_id,project_id,name,key_hash,key_prefix,expires_at)
    SELECT $1,$2,p.id,$4,$5,$6,now()+interval '30 days' FROM local_projects p WHERE p.id=$3 AND p.workspace_id=$2 RETURNING id,name,key_prefix,expires_at`, [randomUUID(), workspaceId, projectId, name, hash, key.slice(0, 15)]);
  if (!result.rowCount) return Response.json({ error: 'Projekt nebyl nalezen.' }, { status: 404 });
  return Response.json({ key, metadata: result.rows[0] }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

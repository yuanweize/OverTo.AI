import { randomUUID } from 'node:crypto';
import { auth, pool } from '@/auth/server';
import { personalWorkspace } from '@/auth/workspace';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  if (!auth || !pool || request.headers.get('origin') !== process.env.BETTER_AUTH_URL) return Response.json({ error: 'Nedostupné.' }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: 'Přihlaste se.' }, { status: 401 });
  const reader = request.body?.getReader(); if (!reader) return Response.json({ error: 'Chybí údaje.' }, { status: 400 });
  const parts: Uint8Array[] = []; let bytes = 0;
  while (true) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.byteLength; if (bytes > 1024) { await reader.cancel(); return Response.json({ error: 'Příliš velký požadavek.' }, { status: 413 }); } parts.push(chunk.value); }
  let body: unknown; try { body = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { return Response.json({ error: 'Neplatné údaje.' }, { status: 400 }); }
  const name = typeof body === 'object' && body !== null && 'name' in body && typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 1 || name.length > 80) return Response.json({ error: 'Název musí mít 1 až 80 znaků.' }, { status: 400 });
  const { workspaceId } = await personalWorkspace(session.user.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM local_workspaces WHERE id=$1 AND user_id=$2 FOR UPDATE', [workspaceId, session.user.id]);
    const count = await client.query<{ count: string }>('SELECT count(*) AS count FROM local_projects WHERE workspace_id=$1', [workspaceId]);
    if (Number(count.rows[0].count) >= 10) { await client.query('ROLLBACK'); return Response.json({ error: 'V místním testu lze vytvořit nejvýše 10 projektů.' }, { status: 409 }); }
    const inserted = await client.query('INSERT INTO local_projects (id, workspace_id, name) VALUES ($1,$2,$3) ON CONFLICT (workspace_id,name) DO NOTHING RETURNING id,name', [randomUUID(), workspaceId, name]);
    await client.query('COMMIT');
    if (!inserted.rowCount) return Response.json({ error: 'Projekt s tímto názvem už existuje.' }, { status: 409 });
    return Response.json({ project: inserted.rows[0] }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch { await client.query('ROLLBACK'); return Response.json({ error: 'Projekt se nepodařilo vytvořit.' }, { status: 500 }); } finally { client.release(); }
}

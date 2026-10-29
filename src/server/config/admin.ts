import 'server-only';
import { auth, pool } from '@/auth/server';
export async function getPlatformAdmin(headers: Headers) {
  if (!auth || !pool) return null;
  const session = await auth.api.getSession({ headers });
  if (!session?.user.emailVerified) return null;
  const result = await pool.query('SELECT user_id FROM platform_admins WHERE user_id=$1 AND role=$2', [session.user.id, 'ROOT']);
  return result.rowCount ? session.user : null;
}

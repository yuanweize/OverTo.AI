import 'server-only';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { pool } from '@/auth/server';
import { getPlatformAdmin } from '@/server/config/admin';

export async function adminContext() {
  const admin = await getPlatformAdmin(await headers());
  if (!admin || !pool) notFound();
  return { admin, pool };
}

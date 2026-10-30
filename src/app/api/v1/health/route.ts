import { NextResponse } from 'next/server';
import { accountDeployment } from '@/auth/deployment';
import { pool } from '@/auth/server';

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  const deployment = accountDeployment(process.env);
  if (deployment?.mode === 'selfhost') {
    try {
      if (!pool) throw new Error('DATABASE_UNAVAILABLE');
      const result = await pool.query("SELECT to_regclass('public.user') IS NOT NULL AND to_regclass('public.credit_accounts') IS NOT NULL AS ready");
      if (!result.rows[0]?.ready) throw new Error('SCHEMA_UNAVAILABLE');
    } catch { return NextResponse.json({ status: 'unavailable', service: 'overto', schemaVersion: '1.0' }, { status: 503, headers }); }
  }
  return NextResponse.json({ status: 'ok', service: 'overto', schemaVersion: '1.0' }, { headers });
}

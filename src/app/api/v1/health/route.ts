import { NextResponse } from 'next/server';
import { accountDeployment } from '@/auth/deployment';
import { pool } from '@/auth/server';

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };

  // Detect configuration typos (OVERTO_SELF_HOST vs OVERTO_SELF_HOSTED)
  if (process.env.OVERTO_SELF_HOST === 'true' && process.env.OVERTO_SELF_HOSTED !== 'true') {
    return NextResponse.json(
      { status: 'unavailable', service: 'overto', schemaVersion: '1.0', error: 'MISCONFIGURED_ENV_USE_OVERTO_SELF_HOSTED' },
      { status: 503, headers }
    );
  }

  const isAuthRequired =
    process.env.OVERTO_SELF_HOSTED === 'true' ||
    process.env.OVERTO_REQUIRE_AUTH === 'true';

  let deployment = null;
  try {
    deployment = accountDeployment(process.env);
  } catch {
    return NextResponse.json(
      { status: 'unavailable', service: 'overto', schemaVersion: '1.0', error: 'INVALID_AUTH_CONFIG' },
      { status: 503, headers }
    );
  }

  if (isAuthRequired || deployment?.mode === 'selfhost') {
    if (!deployment || deployment.mode !== 'selfhost' || !pool) {
      return NextResponse.json(
        { status: 'unavailable', service: 'overto', schemaVersion: '1.0', error: 'AUTH_REQUIRED_BUT_DISABLED' },
        { status: 503, headers }
      );
    }
    try {
      const result = await pool.query(
        "SELECT to_regclass('public.user') IS NOT NULL AND to_regclass('public.credit_accounts') IS NOT NULL AND to_regclass('public.platform_admins') IS NOT NULL AS ready"
      );
      if (!result.rows[0]?.ready) {
        return NextResponse.json(
          { status: 'unavailable', service: 'overto', schemaVersion: '1.0', error: 'SCHEMA_UNAVAILABLE' },
          { status: 503, headers }
        );
      }
    } catch {
      return NextResponse.json(
        { status: 'unavailable', service: 'overto', schemaVersion: '1.0', error: 'DATABASE_UNAVAILABLE' },
        { status: 503, headers }
      );
    }
  }

  return NextResponse.json(
    { status: 'ok', service: 'overto', schemaVersion: '1.0', auth: deployment?.mode ?? 'disabled' },
    { headers }
  );
}

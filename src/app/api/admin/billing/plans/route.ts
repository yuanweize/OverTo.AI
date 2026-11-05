import { pool } from '@/auth/server';
import { getPlatformAdmin } from '@/server/config/admin';
import { BillingCatalog, type PlanInput } from '@/billing/catalog';
import { billingConfig, configuredBillingMode } from '@/billing/config';
import { readRequestBody } from '@/lib/read-request-body';
import { isAllowedOrigin } from '@/server/security/origin';

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: Request) {
  if (!pool) return reply({ error: 'UNAVAILABLE' }, 503);
  const admin = await getPlatformAdmin(request.headers);
  if (!admin) return reply({ error: 'FORBIDDEN' }, 403);
  try {
    return reply({ mode: billingConfig()?.mode ?? 'disabled', requestedMode: configuredBillingMode(process.env), plans: await new BillingCatalog(pool).history() });
  } catch { return reply({ error: 'UNAVAILABLE' }, 503); }
}

export async function POST(request: Request) {
  if (!pool) return reply({ error: 'UNAVAILABLE' }, 503);
  if (!isAllowedOrigin(request.headers.get('origin'))) return reply({ error: 'INVALID_ORIGIN' }, 403);
  const admin = await getPlatformAdmin(request.headers);
  if (!admin) return reply({ error: 'FORBIDDEN' }, 403);
  try {
    const body = JSON.parse(new TextDecoder().decode(await readRequestBody(request, 4096))) as PlanInput;
    const plan = await new BillingCatalog(pool).publish(admin.id, body, request.headers.get('idempotency-key') ?? '');
    return reply({ plan }, 201);
  } catch (error) {
    if (error instanceof Error && ['INVALID_PLAN', 'INVALID_STRIPE_MAPPING', 'PRICE_MAPPING_REQUIRED', 'INVALID_PLAN_DATE', 'INVALID_REQUEST_ID'].includes(error.message)) return reply({ error: error.message }, 400);
    if (error instanceof Error && ['PLAN_KIND_CONFLICT', 'IDEMPOTENCY_CONFLICT'].includes(error.message)) return reply({ error: error.message }, 409);
    if (error instanceof Error && error.message === 'FORBIDDEN') return reply({ error: error.message }, 403);
    return reply({ error: 'PLAN_SAVE_FAILED' }, 503);
  }
}

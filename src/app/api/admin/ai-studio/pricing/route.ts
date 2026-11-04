import { pool } from '@/auth/server';
import { getPlatformAdmin } from '@/server/config/admin';
import { ProviderRepository } from '@/ai/providers/repository';
import { readRequestBody } from '@/lib/read-request-body';
import { isAllowedOrigin } from '@/server/security/origin';

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function PUT(request: Request) {
  if (!pool) return reply({ error: 'UNAVAILABLE' }, 503);
  if (!isAllowedOrigin(request.headers.get('origin'))) return reply({ error: 'INVALID_ORIGIN' }, 403);
  const admin = await getPlatformAdmin(request.headers);
  if (!admin) return reply({ error: 'FORBIDDEN' }, 403);
  let body: Record<string, unknown>;
  try { body = JSON.parse(new TextDecoder().decode(await readRequestBody(request, 3000))); }
  catch { return reply({ error: 'INVALID_PRICING' }, 400); }
  const model = body.model;
  const input = body.inputPerMillionUsd;
  const output = body.outputPerMillionUsd;
  const maximum = body.maxRequestCostUsd;
  if (body.confirmCurrentProviderPricing !== true || typeof model !== 'string' ||
      ![input, output, maximum].every(value => typeof value === 'number' && Number.isFinite(value)) ||
      Number(input) < 0 || Number(output) < 0 || Number(input) + Number(output) <= 0 ||
      Number(maximum) <= 0 || Number(maximum) > 10 || Number(input) > 1000 || Number(output) > 1000) {
    return reply({ error: 'INVALID_PRICING' }, 400);
  }
  try {
    const config = (await new ProviderRepository(pool).read()).config;
    if (!config.allowedModels.includes(model)) return reply({ error: 'MODEL_NOT_ALLOWED' }, 400);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('ai_budget_reservation_lock'))");
      await client.query(`INSERT INTO ai_model_pricing(model,input_per_million_usd,output_per_million_usd,max_request_cost_usd,updated_at,verified_at)
        VALUES($1,$2,$3,$4,now(),now()) ON CONFLICT(model) DO UPDATE SET
        input_per_million_usd=excluded.input_per_million_usd,output_per_million_usd=excluded.output_per_million_usd,
        max_request_cost_usd=excluded.max_request_cost_usd,updated_at=now(),verified_at=now()`, [model, input, output, maximum]);
      await client.query('INSERT INTO ai_operations_audit(actor_id,action,target_id,details) VALUES($1,$2,$3,$4)',
        [admin.id, 'MODEL_PRICING_CONFIRMED', model, JSON.stringify({ inputPerMillionUsd: input, outputPerMillionUsd: output, maxRequestCostUsd: maximum })]);
      await client.query('COMMIT');
      return reply({ model, inputPerMillionUsd: input, outputPerMillionUsd: output, maxRequestCostUsd: maximum, verified: true });
    } catch {
      await client.query('ROLLBACK').catch(() => {});
      return reply({ error: 'PRICING_UNAVAILABLE' }, 503);
    } finally { client.release(); }
  } catch { return reply({ error: 'PRICING_UNAVAILABLE' }, 503); }
}

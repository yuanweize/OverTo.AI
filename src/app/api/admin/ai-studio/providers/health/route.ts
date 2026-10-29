import { pool } from '@/auth/server';
import { getPlatformAdmin } from '@/server/config/admin';
import { ProviderRepository } from '@/ai/providers/repository';
import { checkProviderHealth } from '@/ai/providers/health';
import { SharedRateLimiter } from '@/server/security/shared-rate-limit';

export async function POST(request: Request) {
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!pool) return reply({ error: 'UNAVAILABLE' }, 503);
  if (request.headers.get('origin') !== process.env.BETTER_AUTH_URL) return reply({ error: 'INVALID_ORIGIN' }, 403);
  const admin = await getPlatformAdmin(request.headers);
  if (!admin) return reply({ error: 'FORBIDDEN' }, 403);
  try {
    const permit = await new SharedRateLimiter(pool).consume([{ bucket: `provider-health:${admin.id}`, limit: 2, windowSeconds: 60 }]);
    if (!permit.allowed) return reply({ error: 'RATE_LIMIT', retryAfter: permit.retryAfter }, 429);
    const settings = (await new ProviderRepository(pool).read()).config;
    return reply(await checkProviderHealth(settings, process.env.OPENAI_API_KEY));
  } catch { return reply({ error: 'HEALTH_UNAVAILABLE' }, 503); }
}

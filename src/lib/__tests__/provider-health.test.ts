// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultProviderSettings } from '@/ai/providers-config';
import { checkProviderHealth } from '@/ai/providers/health';

describe('provider health check', () => {
  afterEach(() => { vi.unstubAllEnvs(); });
  it('checks only the registered models endpoint without content or redirects', async () => {
    vi.stubEnv('OPENAI_BASE_URL', 'https://compatible.example/v1');
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    const result = await checkProviderHealth(defaultProviderSettings(), 'synthetic-key', fetcher);
    expect(result.state).toBe('READY');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe('https://compatible.example/v1/models');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'GET', redirect: 'error', cache: 'no-store', headers: { Authorization: 'Bearer synthetic-key' } });
    expect(fetcher.mock.calls[0][1]).not.toHaveProperty('body');
  });
  it('blocks missing credentials or unregistered URLs before fetch', async () => {
    const fetcher = vi.fn();
    expect((await checkProviderHealth(defaultProviderSettings(), undefined, fetcher)).state).toBe('BLOCKED');
    expect((await checkProviderHealth({ ...defaultProviderSettings(), baseUrl: 'https://unregistered.example/v1' }, 'synthetic-key', fetcher)).state).toBe('BLOCKED');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('returns bounded status without exposing a provider response', async () => {
    vi.stubEnv('OPENAI_BASE_URL', 'https://compatible.example/v1');
    const fetcher = vi.fn().mockResolvedValue(new Response('private diagnostic', { status: 401 }));
    expect(await checkProviderHealth(defaultProviderSettings(), 'synthetic-key', fetcher)).toMatchObject({ state: 'HTTP_ERROR', httpStatus: 401 });
    expect(JSON.stringify(await checkProviderHealth(defaultProviderSettings(), 'synthetic-key', fetcher))).not.toContain('private diagnostic');
  });
});

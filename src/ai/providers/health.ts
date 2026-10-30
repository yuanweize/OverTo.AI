import { isAllowedProviderBaseUrl, type ProviderSettings } from '@/ai/providers-config';

export type ProviderHealth = { state: 'READY' | 'HTTP_ERROR' | 'UNAVAILABLE' | 'BLOCKED'; httpStatus: number | null; durationMs: number };

/** Explicit, metadata-only check; it sends no user text and never reads a response body. */
export async function checkProviderHealth(settings: ProviderSettings, key: string | undefined, fetcher: typeof fetch = fetch): Promise<ProviderHealth> {
  if (!key || !isAllowedProviderBaseUrl(settings.baseUrl)) return { state: 'BLOCKED', httpStatus: null, durationMs: 0 };
  const started = Date.now(), controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetcher(`${settings.baseUrl}/models`, { method: 'GET', signal: controller.signal,
      redirect: 'error', headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
    return { state: response.ok ? 'READY' : 'HTTP_ERROR', httpStatus: response.status, durationMs: Date.now() - started };
  } catch {
    return { state: 'UNAVAILABLE', httpStatus: null, durationMs: Date.now() - started };
  } finally { clearTimeout(timer); }
}

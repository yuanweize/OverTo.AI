import { networkInterfaces } from 'node:os';

export interface ProviderSettings {
  enabled: boolean; providerName: string; baseUrl: string; model: string;
  allowedModels: string[]; timeoutMs: number; maxCompletionTokens: number;
}

export function defaultProviderSettings(): ProviderSettings {
  const model = process.env.OPENAI_MODEL || 'gpt-6.1-sol';
  return { enabled: process.env.AI_ENABLED === 'true', providerName: process.env.AI_PROVIDER_NAME || 'Compatible API',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1', model, allowedModels: [model], timeoutMs: 45000, maxCompletionTokens: 900 };
}

/** Admin choices are limited to endpoints registered by the server operator. */
export function isAllowedProviderBaseUrl(value: string): boolean {
  if (value.length > 500 || value.endsWith('/')) return false;
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (url.href !== value || !url.pathname.endsWith('/v1') || url.username || url.password || url.search || url.hash) return false;
  const registered = [process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1', ...(process.env.AI_ALLOWED_BASE_URLS || '').split(',').map(x => x.trim()).filter(Boolean)];
  if (!registered.includes(value)) return false;
  if (url.protocol === 'https:') return true;
  const localAddresses = new Set(['127.0.0.1', '[::1]', ...Object.values(networkInterfaces()).flatMap(entries => entries ?? []).map(entry => entry.address)]);
  return process.env.NODE_ENV === 'development' && process.env.AI_LOCAL_ONLY === 'true' && url.protocol === 'http:' && localAddresses.has(url.hostname);
}

export function validateProviderSettings(input: unknown): ProviderSettings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('INVALID_PROVIDER_CONFIG');
  const x = input as Record<string, unknown>, defaults = defaultProviderSettings();
  const providerName = x.providerName ?? defaults.providerName, baseUrl = x.baseUrl ?? defaults.baseUrl;
  if (Object.keys(x).some(k => !['enabled','providerName','baseUrl','model','allowedModels','timeoutMs','maxCompletionTokens'].includes(k)) ||
      typeof x.enabled !== 'boolean' || typeof providerName !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N} ._()-]{0,79}$/u.test(providerName) ||
      typeof baseUrl !== 'string' || !isAllowedProviderBaseUrl(baseUrl) || typeof x.model !== 'string' ||
      !Array.isArray(x.allowedModels) || x.allowedModels.length < 1 || x.allowedModels.length > 30 || new Set(x.allowedModels).size !== x.allowedModels.length ||
      !x.allowedModels.every(m => typeof m === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/.test(m)) || !x.allowedModels.includes(x.model) ||
      !Number.isInteger(x.timeoutMs) || Number(x.timeoutMs) < 1000 || Number(x.timeoutMs) > 45000 ||
      !Number.isInteger(x.maxCompletionTokens) || Number(x.maxCompletionTokens) < 100 || Number(x.maxCompletionTokens) > 2000) throw Error('INVALID_PROVIDER_CONFIG');
  return { enabled: x.enabled, providerName, baseUrl, model: x.model, allowedModels: [...x.allowedModels], timeoutMs: Number(x.timeoutMs), maxCompletionTokens: Number(x.maxCompletionTokens) };
}

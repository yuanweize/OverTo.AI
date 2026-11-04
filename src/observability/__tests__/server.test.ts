import { afterEach, describe, expect, it, vi } from 'vitest';

const scheduled = vi.hoisted(() => [] as Array<() => Promise<void>>);
vi.mock('next/server', () => ({ after: (fn: () => Promise<void>) => scheduled.push(fn) }));
import { captureServerEvent } from '../server';

describe('server telemetry isolation', () => {
  const original = { ...process.env };
  afterEach(() => { process.env = { ...original }; scheduled.length = 0; vi.unstubAllGlobals(); });

  it('requires consent and ignores delivery failure after the response', async () => {
    process.env.POSTHOG_ENABLED = 'true';
    process.env.POSTHOG_PROJECT_TOKEN = 'phc_test';
    process.env.POSTHOG_HOST = 'https://eu.i.posthog.com';
    process.env.OVERTO_ANALYTICS_ENVIRONMENT = 'qa';
    const event = { event: 'overto.ai_call_completed' as const, properties: { status: 'SUCCESS' as const, reason: 'none' as const, duration_ms: 120, input_tokens: 50, output_tokens: 20, estimated_cost_usd: 0.0001, text: 'private message' } };
    captureServerEvent(new Request('https://overto.example/analyze'), event);
    expect(scheduled).toHaveLength(0);
    const id = 'overto_12345678-1234-1234-1234-123456789abc';
    const request = new Request('https://overto.example/analyze?secret=private', { headers: { Cookie: `overto-analytics-consent=yes; overto-analytics-id=${id}` } });
    captureServerEvent(request, event);
    expect(scheduled).toHaveLength(1);
    const fetchMock = vi.fn().mockRejectedValue(new Error('synthetic outage'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(scheduled[0]()).resolves.toBeUndefined();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ event: 'overto.ai_call_completed', distinct_id: id, properties: { app: 'overto_ai', environment: 'qa', schema_version: 1, $geoip_disable: true, $process_person_profile: false } });
    expect(JSON.stringify(body)).not.toContain('private message');
    expect(JSON.stringify(body)).not.toContain('secret=private');
  });
});

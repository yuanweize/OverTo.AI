import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pageName, safeEvent } from '../events';
import { posthogConfig } from '../config';

const posthog = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn(), opt_out_capturing: vi.fn(), reset: vi.fn(), captureException: vi.fn() }));
vi.mock('posthog-js', () => ({ default: posthog }));
import { analyticsConsent, loadAnalytics, rotateAnalyticsIdentity, setAnalyticsConsent, trackEvent } from '../client';

describe('privacy-gated product analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    posthog.init.mockImplementation(() => posthog);
    document.cookie = 'overto-analytics-consent=; Max-Age=0; Path=/';
    document.cookie = 'overto-analytics-id=; Max-Age=0; Path=/';
  });

  it('stays disabled without explicit runtime configuration', () => {
    expect(posthogConfig({ NODE_ENV: 'production', POSTHOG_ENABLED: 'true' })).toEqual({ enabled: false });
    expect(posthogConfig({ NODE_ENV: 'production', POSTHOG_ENABLED: 'true', POSTHOG_PROJECT_TOKEN: 'phc_test', POSTHOG_HOST: 'https://evil.example' })).toEqual({ enabled: false });
    expect(posthogConfig({ NODE_ENV: 'production', POSTHOG_ENABLED: 'true', POSTHOG_PROJECT_TOKEN: 'phc_test', POSTHOG_HOST: 'https://eu.i.posthog.com' }).enabled).toBe(true);
  });

  it('never accepts paths, query parameters, message text or arbitrary enums', () => {
    expect(pageName('/dashboard/analyses?secret=abc')).toBe('dashboard');
    expect(safeEvent('$pageview', { page: 'home', locale: 'cs', $current_url: 'https://host/?token=secret', text: 'private message' })).toEqual({ event: '$pageview', properties: { page: 'home', locale: 'cs' } });
    expect(safeEvent('overto.analysis_completed', { engine: 'ai', status: 'success', risk: 'HIGH_RISK', surface: 'account', text: 'private message' })?.properties).not.toHaveProperty('text');
    expect(safeEvent('overto.analysis_failed', { engine: 'ai', surface: 'account', category: 'private message' })).toBeNull();
  });

  it('loads once after consent, strips SDK URL properties and stops after revocation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ enabled: true, token: 'phc_test', host: 'https://eu.i.posthog.com', environment: 'qa' }) });
    vi.stubGlobal('fetch', fetchMock);
    trackEvent({ event: '$pageview', properties: { page: 'home', locale: 'cs' } });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(analyticsConsent()).toBeNull();
    setAnalyticsConsent(true);
    await Promise.all([loadAnalytics(), loadAnalytics()]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(posthog.init).toHaveBeenCalledOnce();
    const config = posthog.init.mock.calls[0][1];
    expect(config).toMatchObject({ autocapture: false, capture_pageview: false, disable_session_recording: true, capture_exceptions: false, persistence: 'memory' });
    const filtered = config.before_send({ event: '$pageview', properties: { token: 'phc_test', $current_url: 'https://app/?secret=abc', text: 'private message', page: 'home', locale: 'cs' } });
    expect(JSON.stringify(filtered)).not.toContain('secret');
    expect(JSON.stringify(filtered)).not.toContain('private message');
    expect(filtered.properties).toMatchObject({ $geoip_disable: true, $process_person_profile: false });
    const exception = config.before_send({ event: '$exception', properties: { $current_url: 'https://app/?secret=abc' } });
    expect(exception.properties).toMatchObject({ $geoip_disable: true, $process_person_profile: false });
    const previousId = filtered.properties.distinct_id;
    rotateAnalyticsIdentity();
    const rotated = config.before_send({ event: '$pageview', properties: { page: 'home', locale: 'cs' } });
    expect(rotated.properties.distinct_id).not.toBe(previousId);
    expect(posthog.reset).toHaveBeenCalledWith(expect.objectContaining({ bootstrap: expect.objectContaining({ distinctID: rotated.properties.distinct_id }) }));
    trackEvent({ event: '$pageview', properties: { page: 'home', locale: 'cs' } });
    await Promise.resolve();
    expect(posthog.capture).toHaveBeenCalledOnce();
    setAnalyticsConsent(false);
    trackEvent({ event: '$pageview', properties: { page: 'home', locale: 'cs' } });
    await Promise.resolve();
    expect(posthog.capture).toHaveBeenCalledOnce();
    expect(posthog.opt_out_capturing).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

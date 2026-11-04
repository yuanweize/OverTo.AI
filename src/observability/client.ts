'use client';
import type { PostHog } from 'posthog-js';
import type { AnalyticsEvent } from './events';
import { safeEvent } from './events';
import type { PostHogConfig } from './config';

const consentName = 'overto-analytics-consent';
const idName = 'overto-analytics-id';
let instance: PostHog | null = null;
let pending: Promise<PostHog | null> | null = null;
let environment = 'development';

function cookie(name: string): string | undefined {
  return document.cookie.split('; ').find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
}
function writeCookie(name: string, value: string, days: number) {
  document.cookie = `${name}=${value}; Path=/; Max-Age=${days * 86400}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
}
export function analyticsConsent(): 'yes' | 'no' | null {
  const value = cookie(consentName);
  return value === 'yes' || value === 'no' ? value : null;
}
export function setAnalyticsConsent(enabled: boolean) {
  writeCookie(consentName, enabled ? 'yes' : 'no', 180);
  if (enabled) {
    writeCookie(idName, `overto_${crypto.randomUUID()}`, 180);
    if (instance) location.reload();
  }
  else {
    writeCookie(idName, '', 0);
    instance?.opt_out_capturing();
    instance?.reset();
  }
}
export function rotateAnalyticsIdentity() {
  if (analyticsConsent() !== 'yes') return;
  const id = `overto_${crypto.randomUUID()}`;
  writeCookie(idName, id, 180);
  instance?.reset({ resetDeviceID: true, bootstrap: { distinctID: id, isIdentifiedID: false } });
}

export async function loadAnalytics(): Promise<PostHog | null> {
  if (analyticsConsent() !== 'yes') return null;
  if (instance) return instance;
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await fetch('/api/analytics/config', { cache: 'no-store' });
      if (!response.ok) return null;
      const config = await response.json() as PostHogConfig;
      if (!config.enabled || analyticsConsent() !== 'yes') return null;
      environment = 'environment' in config && typeof config.environment === 'string' ? config.environment : 'development';
      const id = cookie(idName);
      if (!id || !/^overto_[0-9a-f-]{36}$/i.test(id)) return null;
      const { default: posthog } = await import('posthog-js');
      if (analyticsConsent() !== 'yes') return null;
      instance = posthog.init(config.token, {
        api_host: config.host,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        capture_exceptions: false,
        disable_session_recording: true,
        disable_surveys: true,
        disable_web_experiments: true,
        disable_external_dependency_loading: true,
        advanced_disable_feature_flags: true,
        mask_all_text: true,
        mask_all_element_attributes: true,
        persistence: 'memory',
        person_profiles: 'never',
        bootstrap: { distinctID: id, isIdentifiedID: false },
        before_send: captured => {
          if (analyticsConsent() !== 'yes') return null;
          const currentId = cookie(idName);
          if (!currentId || !/^overto_[0-9a-f-]{36}$/i.test(currentId)) return null;
          if (captured.event === '$exception') {
            return { ...captured, properties: {
              token: config.token,
              distinct_id: currentId,
              $exception_list: [{ type: 'BrowserError', value: 'browser_runtime_failure', stacktrace: { frames: [] } }],
              $exception_fingerprint: 'browser_runtime_failure',
              $issue_name: 'Browser runtime failure',
              app: 'overto_ai', environment, schema_version: 1, source: 'browser',
            } };
          }
          const event = safeEvent(captured.event, captured.properties || {});
          if (!event) return null;
          return { ...captured, properties: {
            token: config.token,
            distinct_id: currentId,
            ...event.properties,
            app: 'overto_ai', environment, schema_version: 1, source: 'browser',
          } };
        },
      });
      return instance;
    } catch { return null; }
    finally { pending = null; }
  })();
  return pending;
}

export function trackEvent(event: AnalyticsEvent) {
  const safe = safeEvent(event.event, event.properties);
  if (!safe || analyticsConsent() !== 'yes') return;
  void loadAnalytics().then(ph => { if (ph && analyticsConsent() === 'yes') ph.capture(safe.event, safe.properties); });
}

let lastBrowserError = 0;
export function trackBrowserError() {
  if (analyticsConsent() !== 'yes' || Date.now() - lastBrowserError < 60_000) return;
  lastBrowserError = Date.now();
  void loadAnalytics().then(ph => { if (ph && analyticsConsent() === 'yes') ph.captureException(new Error('Browser runtime failure')); });
}

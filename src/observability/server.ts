import 'server-only';
import { after } from 'next/server';
import { analyticsEnvironment, posthogConfig } from './config';
import { safeEvent, type AnalyticsEvent } from './events';

function consentId(request: Request): string | null {
  const entries = Object.fromEntries((request.headers.get('cookie') || '').split(';').map(entry => entry.trim().split('=', 2)));
  const id = entries['overto-analytics-id'];
  return entries['overto-analytics-consent'] === 'yes' && id && /^overto_[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

/** Response-independent, bounded delivery. Failures are intentionally silent. */
export function captureServerEvent(request: Request, event: AnalyticsEvent | { event: '$exception'; properties: { category: 'analysis_server' | 'provider_timeout' | 'provider_failure' | 'database' } }) {
  const config = posthogConfig();
  const id = consentId(request);
  if (!config.enabled || !id) return;
  const projected = event.event === '$exception' ? null : safeEvent(event.event, event.properties);
  if (event.event !== '$exception' && !projected) return;
  const properties = event.event === '$exception'
    ? { $exception_list: [{ type: 'OperationalError', value: event.properties.category, stacktrace: { frames: [] } }], $exception_fingerprint: event.properties.category, $issue_name: event.properties.category }
    : projected!.properties;
  try { after(async () => {
    try {
      await fetch(`${config.host}/i/v0/e/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: config.token, distinct_id: id, event: event.event, properties: { ...properties, app: 'overto_ai', environment: analyticsEnvironment(), schema_version: 1, source: 'server', $process_person_profile: false } }),
        signal: AbortSignal.timeout(1500), redirect: 'error',
      });
    } catch { /* Telemetry must never affect analysis or billing. */ }
  }); } catch { /* No request context or unavailable scheduler must not affect the caller. */ }
}

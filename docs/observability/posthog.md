# Optional PostHog EU analytics

OvěřTo.AI uses the HKTSE **Default project** in PostHog EU. No separate project or paid plan is required. Analytics is optional and does not decide AI access, budgets, billing or security rules. The internal AI Studio trace remains the source for provider costs and prompt versions.

## Configure

Set these values in a private runtime environment (Compose `.env.selfhost` or Render environment):

```ini
POSTHOG_ENABLED=true
POSTHOG_PROJECT_TOKEN=phc_<shared Default project token>
POSTHOG_HOST=https://eu.i.posthog.com
```

Leave `POSTHOG_ENABLED=false` or omit the token to disable. The project token is a public ingestion credential, never a PostHog personal API key. `/api/analytics/config` returns only the enable flag, ingestion host and project token. Docker reads it at **runtime**, so changing it requires an app restart, not an image rebuild. Do not put the token in a public example file. Production accepts the EU host only; local nonproduction tests may use a loopback HTTP mock.

## Consent and data flow

The browser requests runtime configuration, then waits for separate analytics consent before loading `posthog-js`. Decline sends no SDK request. Consent is stored in a first-party `overto-analytics-consent` cookie; a separate `overto-analytics-id` cookie holds a random `overto_`-prefixed ID. The site offers a persistent settings control to withdraw consent. Logout and account deletion rotate that ID. The HKTSE website has its own domain and identity; this integration does not merge identities across apps.

Autocapture, automatic pageviews, session replay, surveys, feature flags, experiments and automatic exception capture are disabled. `$pageview` is sent manually with a page **category**, not the route or full URL. A final SDK `before_send` projection drops all SDK-added page URLs, referrers, queries, hashes, DOM text and extra properties. Browser errors send generic categories without their raw message or stack. The server emits only safe category/count events after a response using Next.js `after()`; a 1.5-second timeout and ignored transport failures keep PostHog off the critical path. No message, prompt, model response, email, API key, checkout URL or payment record is sent.

Every event includes `app=overto_ai`, `environment` and `schema_version=1`. The shared project should filter `app=overto_ai` and `environment=production`. Browser identity is random and app-scoped; it is not a user database ID.
Set `OVERTO_ANALYTICS_ENVIRONMENT=qa` in an isolated production-mode QA stack so synthetic tests do not enter production dashboard filters. Normal production deployments derive `environment=production` automatically.

| Event | Source | Meaning |
| --- | --- | --- |
| `$pageview` | Browser | One named page category after consent; route changes are deduplicated. |
| `overto.analysis_started` | Browser | User submits a reviewed analysis. |
| `overto.analysis_completed` | Browser | Result is shown; includes rules/AI and fallback enum. |
| `overto.analysis_failed` | Browser | Analysis request did not produce a result. |
| `overto.signup_completed` | Browser | Signup endpoint accepted the new account; email verification is separate. |
| `overto.login_completed` | Browser | Login succeeded. |
| `overto.checkout_started` | Browser | Stripe **Test Mode** checkout URL accepted; not a payment event. |
| `overto.ai_call_completed` | Server | Dispatched model call with status, failure category, duration, token counts and estimated cost. |
| `$exception` | Browser/server | Generic operational category only. |

There is no `subscription_activated` event: actual Stripe webhook and internal ledger are authoritative. Event payloads intentionally cannot support attribution by full referrer URL or user email.

## Dashboard

The shared Default project contains [**OvěřTo.AI | Product Analytics**](https://eu.posthog.com/project/334746/dashboard/1085613). Every saved insight filters `app = overto_ai` and `environment = production`; QA events are excluded. The dashboard shows page views and daily unique visitors, analysis starts/completions/failures and their event-count completion ratio, signup acceptance, dispatched AI calls, safe AI failure reasons, and a consented signup-page-to-signup funnel. These are analytics indicators, not the authoritative AI cost or payment records. Production charts will remain sparse until the production app is deployed with consented analytics. Do not infer payment from checkout navigation.

## Verify and recover

Use the isolated QA Compose environment and `OVERTO_POSTHOG_E2E=true npx playwright test e2e/posthog.e2e.ts --workers=1`. That test intercepts the EU endpoint, verifies decline/accept/withdrawal and rejects URL query leakage. `src/observability/__tests__/analytics.test.ts` checks configuration, event projection and missing-token behavior. For a real connection, use a synthetic event in the shared project, then inspect the network request and PostHog activity with `app=overto_ai`; a browser HTTP 200 alone does not prove ingestion. Never test with a real message.

If PostHog is unavailable, the product continues normally. Disable at runtime with `POSTHOG_ENABLED=false` and restart the app. Revoke the project token in PostHog if it is abused, then rotate it in each HKTSE app using it. Recheck the project retention policy and processing terms before production enablement; this document does not make a blanket compliance claim.

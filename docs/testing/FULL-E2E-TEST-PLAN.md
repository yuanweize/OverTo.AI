# Local end-to-end test plan

Run only against the disposable loopback account database at `127.0.0.1:55443/overto` and Mailpit on `127.0.0.1:1025/8025`. `.env.local` must stay ignored. Start the server before browser tests:

```sh
npm run migrate:local
npm run dev -- --hostname 127.0.0.1 -p 3005
```

In another terminal:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:e2e
```

The standard suite deliberately skips the privileged admin journey. To run that journey separately, after checking the test database contains only synthetic accounts, set `OVERTO_ADMIN_E2E=true` for `npx playwright test e2e/admin-settings.e2e.ts`. The shared evaluation limiter allows one run per five minutes; an immediate repeat can correctly return 429. Tests use synthetic emails and should never print verification URLs.

Acceptance covers guest rules, signup, verification, login, password reset, project isolation, analysis and credit use, API key creation/scope/rotation/revocation, daily usage display, Playground, Stripe disabled state, root administration, provider/model configuration, rules evaluation and logout. Stripe Checkout, signed webhook and portal require a separate explicit test-mode run; their prior evidence is [recorded here](../saas/stripe-live-test.md). Prompt activation against a mock gateway and production email remain unaccepted.

For screenshots, set `OVERTO_CAPTURE_UI=true` and inspect `assets/screenshots/` before sharing. Capture light/dark and Czech/English at 375, 390, 768, 1024 and 1440px. Never capture a revealed API key, real message, provider secret or Mailpit link. Do not count skipped tests as passed.

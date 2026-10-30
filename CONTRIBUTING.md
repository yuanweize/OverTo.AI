# Contributing

Open an issue describing the problem and expected behavior before large changes. Use synthetic test data; never include actual messages, personal details, one-time links or credentials. For a vulnerability, follow [SECURITY.md](SECURITY.md) instead of posting details in a public issue.

Run `npm ci`, `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` and `npm run docs:check`. PostgreSQL integration tests require the separate disposable `overto_test` database described in [implementation status](docs/development/IMPLEMENTATION-STATUS.md). UI changes should include a local browser check at mobile and desktop sizes; see the [visual review](docs/design/FINAL-VISUAL-REVIEW.md). Follow the [pull request checklist](.github/pull_request_template.md) and report passed, failed and skipped checks separately.

Explain safety and privacy implications. Do not claim effectiveness without a reproducible representative evaluation, or production readiness from a passing unit test. Contributions are subject to the project license, and authors must have the right to submit them.

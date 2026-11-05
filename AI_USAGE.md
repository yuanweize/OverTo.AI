# AI Usage & Governance

OvěřTo.AI supports optional, privacy-conscious model inference via any OpenAI-compatible API endpoint (`/v1/chat/completions`). When enabled, the model supplements deterministic heuristic rules with structured risk analysis.

## Core Principles

1. **User Consent Required:** AI analysis is never invoked automatically without explicit opt-in from the user.
2. **Prior Review & PII Redaction:** Text is reviewed and sanitized on the client before transmission. Users can inspect and edit the redacted preview.
3. **Strict Output Validation:** The response from the model provider must conform to a strict JSON schema. Furthermore, every quoted excerpt in the model's output is verified to exist verbatim in the sanitized source text. If a quote cannot be verified, the hallucinated signal is rejected.
4. **Deterministic Precedence:** Model outputs can suggest additional risk signals, but they can never dismiss or downgrade a critical flag identified by the deterministic rule engine.
5. **Zero Payload Storage:** Raw message contents are never stored in the database. Only operational telemetry (token counts, duration, estimated cost) is recorded in administrative trace logs.

## Production Security & Budget Controls

- **Explicit production enablement:** Production inference requires `AI_ENABLED=true`, `AI_PRODUCTION_ENABLED=true`, a server-side provider key, an allowed HTTPS endpoint, an enabled model, operator-confirmed current pricing and a successful atomic budget reservation. The public demo remains Rules-only by default. Anonymous paid AI requires a separate `AI_ANONYMOUS_ENABLED=true` choice; account requests retain their workspace and project attribution.
- **PostgreSQL Atomic Budget Guard:** When AI inference is enabled, `AiBudgetGuard` (`src/server/ai/budgets.ts`, `migrations/016_ai_budget_reservations.sql`) uses PostgreSQL advisory and row-level locks to enforce atomic spending caps:
  - Daily and monthly platform financial ceilings; reservations record workspace and project attribution, but do not enforce separate per-workspace dollar caps.
  - Pre-allocation reservations prior to dispatching requests.
  - Settlement from provider-reported token usage against the price snapshot; missing usage or dispatched failures conservatively consume the reserved ceiling. Provider pricing and usage are estimates, not a provider invoice.
  - Fail-closed fallback to deterministic rules when ceilings are exceeded.
- **Provider Registry & Whitelist:** Platform operators configure endpoints via `OPENAI_BASE_URL` or `AI_ALLOWED_BASE_URLS`. Root administrators can test endpoint health and manage active model configurations within the AI Studio.
- **Operator price confirmation:** Historical seed prices are unverified and cannot authorize a paid request. ROOT must enter current input/output prices and maximum request cost in AI Studio → Models. Prompt Lab tests use the same budget gate. `AI_EMERGENCY_DISABLE=true` or disabling the provider stops new requests.

## Local Development Configuration

To experiment with AI models in local development:

```sh
# Copy environment configuration
cp .env.example .env.local

# Configure your provider credentials in .env.local:
# OPENAI_BASE_URL=https://api.openai.com/v1
# OPENAI_MODEL=gpt-4o-mini
# OPENAI_API_KEY=sk-...

# Run development server on loopback
npm run dev -- -p 3005
```

Run `npm run ai:check` to verify the provider connection and schema adherence with a single bounded test request.

For production self-hosting, configure the endpoint, model, key and small positive `AI_MAX_REQUEST_BUDGET_USD`, `AI_DAILY_BUDGET_USD`, and `AI_MONTHLY_BUDGET_USD` in the private environment. Set `AI_PRODUCTION_ENABLED=true` only after confirming prices and testing the selected model's JSON schema and usage response. Restart the app after changing environment flags. The isolated HTTPS Mock journey is `OVERTO_PRODUCTION_AI_E2E=true npx playwright test e2e/production-ai.e2e.ts --workers=1`; it requires the dedicated `.env.ai-qa` Compose stack and never calls a paid model.

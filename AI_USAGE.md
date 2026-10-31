# AI Usage & Governance

OvěřTo.AI supports optional, privacy-conscious model inference via any OpenAI-compatible API endpoint (`/v1/chat/completions`). When enabled, the model supplements deterministic heuristic rules with structured risk analysis.

## Core Principles

1. **User Consent Required:** AI analysis is never invoked automatically without explicit opt-in from the user.
2. **Prior Review & PII Redaction:** Text is reviewed and sanitized on the client before transmission. Users can inspect and edit the redacted preview.
3. **Strict Output Validation:** The response from the model provider must conform to a strict JSON schema. Furthermore, every quoted excerpt in the model's output is verified to exist verbatim in the sanitized source text. If a quote cannot be verified, the hallucinated signal is rejected.
4. **Deterministic Precedence:** Model outputs can suggest additional risk signals, but they can never dismiss or downgrade a critical flag identified by the deterministic rule engine.
5. **Zero Payload Storage:** Raw message contents are never stored in the database. Only operational telemetry (token counts, duration, estimated cost) is recorded in administrative trace logs.

## Production Security & Budget Controls

- **Rules-Only Production Default:** Public container images and demo blueprints default to **Rules-only** mode (`AI_LOCAL_ONLY`). External LLM calls are disabled by default to safeguard against unexpected API expenses and unauthorized external data transfer.
- **PostgreSQL Atomic Budget Guard:** When AI inference is enabled, `AiBudgetGuard` (`src/server/ai/budgets.ts`, `migrations/016_ai_budget_reservations.sql`) uses PostgreSQL advisory and row-level locks to enforce atomic spending caps:
  - Daily and monthly financial ceilings per workspace and platform.
  - Pre-allocation reservations prior to dispatching requests.
  - Settlement with exact token accounting and cost recording.
  - Fail-closed fallback to deterministic rules when ceilings are exceeded.
- **Provider Registry & Whitelist:** Platform operators configure endpoints via `OPENAI_BASE_URL` or `AI_ALLOWED_BASE_URLS`. Root administrators can test endpoint health and manage active model configurations within the AI Studio.

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

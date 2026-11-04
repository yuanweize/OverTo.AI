<div align="center">

<img src="public/brand/mark.svg" width="64" height="64" alt="OvěřTo.AI Logo" />

# OvěřTo.AI

**Open-source scam detection and verification platform.**

An evidence-led assistant for Czech and multilingual messages, helping people examine suspicious communications, identify grounded warning signs, and independently verify requests before taking irreversible action.

[![CI](https://github.com/yuanweize/OverTo.AI/actions/workflows/ci.yml/badge.svg)](https://github.com/yuanweize/OverTo.AI/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/yuanweize/OverTo.AI?color=2454cf)](https://github.com/yuanweize/OverTo.AI/releases)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-2454cf.svg)](LICENSE)
[![GHCR](https://img.shields.io/badge/GHCR-Container_Image-blue?logo=docker)](https://github.com/users/yuanweize/packages/container/package/overto.ai)

[Quick Start](#quick-start) · [Core Features](#core-features) · [Visual Showcase](#product-showcase) · [Architecture](#how-it-works) · [API](#api-at-a-glance) · [Self-Hosting](docs/deployment/self-host.md) · [Documentation](#documentation) · [Čeština](README.cs.md)

</div>

<p align="center">
  <img src="assets/screenshots/v7-analyze-cs-1440.png" width="100%" alt="OvěřTo.AI evidence-led analysis interface" />
  <br />
  <sub><strong>Evidence-Led Scam Analysis (Desktop)</strong> — Transparent extraction of fraud signals, heuristic risk scoring, and recommended out-of-band next steps.</sub>
</p>

---

## Core Features

- **Deterministic Rule Engine & Risk Scoring**  
  High-speed heuristic pattern matching and offline URL analysis that detects spoofed domains, homoglyphs, urgency triggers, and financial fraud markers without visiting external links.
- **Privacy-First Client Redaction**  
  Best-effort pattern masking runs directly in the browser to scrub personal identifiable information (PII) before submission, featuring an interactive editable preview.
- **Grounded Evidence & Action Graph**  
  Links exact UTF-16 span indices in the source text directly to identified warning signs, providing verifiable rationale rather than opaque classifications.
- **Actionable Verification Guidance**  
  Recommends official, out-of-band contact channels and safe protocol handling for high-risk situations (such as banking fraud, parcel delivery scams, or credential theft).
- **Developer API & OpenAPI 3.1**  
  Versioned REST endpoint (`/api/v1/analyses`), scoped tenant API keys with daily rate limits, and an interactive browser-based API playground.
- **Self-Hosted Architecture & AI Studio**  
  Self-hosted Docker Compose deployment powered by PostgreSQL 17, Better Auth with email verification, transactional credit ledger, Stripe test billing, and an administrative AI Studio protected by atomic concurrency budgets.

---

## Product Showcase

A curated overview of the OvěřTo.AI web platform across desktop, tablet, and mobile interfaces.

### 1. Tenant Workspace & Usage Dashboard
![Tenant Dashboard](assets/screenshots/v7-dashboard-cs-1440.png)
*Personal workspace dashboard providing real-time visibility into credit balances, active projects, and daily analysis volume.*

### 2. Developer Tools & Accessible API Documentation
![Developer Documentation Tablet](assets/screenshots/v7-developers-cs-dark-1024-a11y.png)
*Developer documentation designed with WCAG AA contrast guidelines, featuring parameter breakdowns, request code snippets, and error schemas.*

### 3. Platform Administration & AI Studio (ROOT Only)
![AI Studio Traces Dark](assets/screenshots/v7-ai-studio-en-dark.png)
*Real-time trace observability detailing token consumption, latency, USD cost estimation, and PostgreSQL atomic budget enforcement.*

### 4. Mobile Experience & Dark Mode Analysis
![Mobile Analysis Dark](assets/screenshots/v7-analyze-en-dark-390.png)
*Responsive mobile analysis interface in dark mode displaying identified warning signs and verification guidance.*

👉 *Explore the complete collection of all 52 interface captures, mobile layouts, and theme comparisons in the [Visual Showcase Gallery](docs/showcase.md).*

---

## Quick Start

### 1. Local Rules-Only Development

The quickest way to run OvěřTo.AI locally. Runs completely offline using deterministic rules without requiring database setup or external API keys:

```sh
# Clone repository
git clone https://github.com/yuanweize/OverTo.AI.git
cd OverTo.AI

# Install dependencies and start development server
npm ci
npm run dev -- -p 3005
```

Open [http://127.0.0.1:3005](http://127.0.0.1:3005) in your browser.

### 2. Production Self-Hosted SaaS (Docker Compose)

Deploy the personal-workspace application with PostgreSQL 17, automated schema migrations, authentication, and SMTP delivery:

```sh
# 1. Prepare environment configuration
cp .env.selfhost.example .env.selfhost
# Edit .env.selfhost with your secrets, host domain, and SMTP settings

# 2. Start services (PostgreSQL, automatic migrations, Next.js app)
docker compose --env-file .env.selfhost -f compose.saas.yaml up -d --build

# 3. Bootstrap initial platform root administrator
docker compose --env-file .env.selfhost -f compose.saas.yaml run --rm --no-deps migrate \
  ./node_modules/.bin/tsx scripts/bootstrap-admin.ts admin@yourdomain.com
```

The application will be live at `http://127.0.0.1:3006`. See the [Self-Hosting Guide](docs/deployment/self-host.md) for reverse proxy setup, backup scripts, and environment variable references.

---

## How It Works

```mermaid
flowchart LR
  A[User Input] --> B[Client PII Redaction & Preview]
  B --> C[Server Sanitization]
  C --> D[Deterministic Rules & Offline URL Parser]
  D --> E{AI Enabled & Permitted?}
  E -->|Yes| F[OpenAI-Compatible LLM Adapter]
  F --> G[Schema Validation & Grounded Quote Matching]
  E -->|No / Gated| H[Rules-Only Result]
  G --> I[Risk Scoring & Action Graph]
  H --> I
  I --> J[Safe Out-of-Band Guidance]
```

1. **Review & Redact:** Sensitive personal details (names, phone numbers, emails) are masked on the client with an editable preview prior to sending.
2. **Deterministic Rules:** Text and links undergo heuristic pattern matching and offline URL structure analysis without fetching untrusted web pages.
3. **Optional AI Inference:** If explicitly enabled and funded by the operator, an OpenAI-compatible model proposes structured signals. Outputs must pass strict JSON schema checks and verbatim source quote validation.
4. **Action Graph:** Signals link directly to exact UTF-16 text spans in the input message.
5. **Guidance:** Recommends safe, out-of-band actions tailored to the specific scam vector.

---

## API at a Glance

A local guest request requires **no API key** and evaluates using deterministic rules:

```sh
curl http://127.0.0.1:3005/api/v1/analyses \
  -H "Content-Type: application/json" \
  --data '{"text":"Vážený kliente, váš účet byl zablokován. Klikněte zde: https://csob-zabezpeceni.cz", "enableLlm":false}'
```

Example response:

```json
{
  "schemaVersion": "1.0",
  "status": "COMPLETED",
  "decision": "HIGH_RISK",
  "signals": [
    {
      "id": "IMPERSONATION_CSOB",
      "category": "IMPERSONATION",
      "severity": "CRITICAL",
      "title": "Possible look-alike domain",
      "description": "The hostname contains a known brand name but does not match the configured domain list.",
      "matchedSnippet": "https://csob-zabezpeceni.cz/"
    }
  ],
  "recommendedActions": [
    {
      "step": 1,
      "action": "Avoid opening the message’s link until you verify it",
      "rationale": "The address has warning signs. Use an independently known website or app to check the request.",
      "isWarning": true
    },
    {
      "step": 2,
      "action": "Contact your bank using the number on your card or in its app",
      "rationale": "Ask the bank to check the claim. Do not use a phone number supplied in the suspicious message.",
      "isWarning": false
    }
  ],
  "engine": {
    "mode": "DETERMINISTIC_RULES",
    "providerStatus": "NOT_REQUESTED",
    "model": null
  },
  "metadata": {
    "engineVersion": "0.1.0",
    "rulesetVersion": "development",
    "decisionPolicyVersion": "1"
  }
}
```

Authenticated requests use bearer token API keys with shared daily quotas. See the [API Reference](docs/api/v1.md) and [OpenAPI Specification](docs/api/openapi.yaml).

---

## Documentation

| Topic | Description | Link |
|---|---|---|
| **Deployment** | Production Docker Compose, environment configuration, and backups | [Self-Hosting Guide](docs/deployment/self-host.md) |
| **Render Blueprint** | Cloud deployment blueprint and health verification guide | [Render Demo Guide](docs/deployment/render-demo.md) |
| **API Reference** | Endpoints, authentication, rate limits, and schemas | [docs/api/v1.md](docs/api/v1.md) |
| **OpenAPI Contract** | Machine-readable OpenAPI 3.1 specification | [openapi.yaml](docs/api/openapi.yaml) |
| **Architecture** | System pipelines, multi-tenancy, and budget mechanisms | [ARCHITECTURE.md](ARCHITECTURE.md) |
| **AI Governance** | Model integration, budget guards, and privacy boundaries | [AI_USAGE.md](AI_USAGE.md) |
| **Limitations** | Operational boundaries and security considerations | [LIMITATIONS.md](LIMITATIONS.md) |
| **Administration** | Tenant management, audit logs, and system operations | [Operations Guide](docs/administration/operations.md) |
| **AI Studio** | Trace telemetry, Prompt Lab, and model registries | [AI Traces](docs/administration/ai-traces.md) · [Prompt Lab](docs/administration/prompts.md) |
| **Visual Showcase** | Full catalog of all 52 application screenshots | [Showcase Gallery](docs/showcase.md) |
| **Evaluation** | Synthetic challenge datasets and evaluation methodology | [docs/evaluation/ai-evaluation.md](docs/evaluation/ai-evaluation.md) |
| **Testing** | Security, end-to-end, and deployment test plans | [Security](docs/testing/SECURITY-TEST-PLAN.md) · [E2E](docs/testing/FULL-E2E-TEST-PLAN.md) · [Deployment](docs/testing/DEPLOYMENT-TEST-PLAN.md) |

---

## Operational Limitations

- **Not a Security Guarantee:** Both deterministic heuristic rules and optional LLM analysis can produce false positives and false negatives. An `INSUFFICIENT_EVIDENCE` verdict is never proof that a message is safe.
- **Out-of-Band Verification Always Required:** Critical, urgent, or financial requests should always be validated through independent, known-good channels (such as official banking phone numbers).
- **Production AI:** Rules-only remains the default. Self-hosted operators can explicitly enable budgeted external inference after confirming model prices and configuring a server-held provider key; the public demo stays Rules-only. The production-mode path is verified with an isolated HTTPS Mock, while live provider and public deployment verification are separate operational steps. See [AI Usage](AI_USAGE.md).
- **Optional analytics:** Consent-gated PostHog EU events can be enabled at runtime. No message text, email, full URL or replay is sent. See [PostHog setup](docs/observability/posthog.md).
- **Client Redaction is Best-Effort:** Automated PII masking targets standard patterns (phone numbers, emails, names) but cannot guarantee complete scrubbing of subtle identifying details.
- For a comprehensive analysis of system boundaries, read [LIMITATIONS.md](LIMITATIONS.md).

---

## Development

```sh
# Run unit and integration tests
npm test

# Typecheck and linting
npx tsc --noEmit
npm run lint

# Documentation and secret verification
npm run docs:check
npm run secrets:check

# Production build
npm run build
```

---

## Contributing & Security

- Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.
- For security vulnerabilities, please refer to our [Security Policy](SECURITY.md). Never submit vulnerability reports to public issue trackers.

## License

This project is licensed under the [Apache-2.0 License](LICENSE).
Third-party component notices and licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

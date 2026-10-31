# OvěřTo.AI — Interface Showcase & Visual Catalog

This document showcases the visual interface of **OvěřTo.AI**, illustrating its responsive layout across desktop (1440px), tablet (1024px/768px), and mobile (390px/375px) viewports, its dual light and dark themes, and its WCAG AA accessible design system.

All screenshots represent actual running software captured in Chromium environments without simulated mocks.

---

## 1. Evidence-Led Scam Analysis

The core user experience centers on transparent, evidence-led inspection of suspicious Czech and English messages. Deterministic heuristic rules extract textual signals and calculate calibrated risk scores, accompanied by verified out-of-band next steps.

### Desktop Analysis & Grounded Evidence (Czech, 1440px)
![Czech Analysis and Grounded Evidence](../assets/screenshots/v7-analyze-cs-1440.png)
*Detailed analysis view displaying highlighted textual warning signs, computed risk tier, and prioritized action steps.*

| English Mobile Analysis (Dark, 390px) | Action Graph Signal Attribution |
|:---:|:---:|
| ![English Dark Mobile Analysis](../assets/screenshots/v7-analyze-en-dark-390.png) | ![Action Graph](../assets/screenshots/action-graph.png) |
| *Mobile analysis view with risk badges and action cards* | *Underlying action graph linking exact text spans to signals* |

### Workspace Project Analysis
![In-Project Scam Analysis](../assets/screenshots/saas-project-analysis.png)
*Scam analysis run within an authenticated tenant workspace, maintaining audit history.*

---

## 2. Interactive Landing & Mobile Views

A privacy-focused interface that encourages users to review and redact sensitive PII before any analysis is performed.

### Desktop Landing Experience (English, 1440px)
![English Desktop Landing](../assets/screenshots/v7-home-en-1440.png)
*Full desktop hero featuring inline message analysis, privacy disclosure, and responsive navigation.*

| Czech Mobile Landing (Dark, 390px) | Tablet Verification Process (Dark, 768px) |
|:---:|:---:|
| ![Czech Dark Mobile Home](../assets/screenshots/v7-home-cs-dark-390.png) | ![How It Works Tablet](../assets/screenshots/v7-how-cs-dark-768.png) |
| *Single-column mobile hero with instant paste and analyze* | *Three-step independent verification walkthrough* |

| Ultra-Compact Mobile Features (375px) | Baseline Desktop Landing (1280px) |
|:---:|:---:|
| ![Mobile Features](../assets/screenshots/v7-features-cs-375.png) | ![Baseline Desktop Landing](../assets/screenshots/home-desktop.png) |
| *Capability breakdown on narrow mobile viewports* | *Standard responsive landing view* |

| Baseline Mobile Landing | SaaS Landing Overview |
|:---:|:---:|
| ![Baseline Mobile Landing](../assets/screenshots/home-mobile.png) | ![SaaS Home Desktop](../assets/screenshots/saas-home-desktop.png) |
| *Compact mobile landing baseline* | *Multi-tenant SaaS marketing overview* |

---

## 3. Workspaces, Projects & Tenant Dashboard

Authenticated users receive a dedicated workspace providing usage statistics, project partitioning, and credit balance visibility.

### Tenant Workspace Dashboard (Czech, 1440px)
![Tenant Dashboard Desktop](../assets/screenshots/v7-dashboard-cs-1440.png)
*Personal workspace dashboard showing credit ledger balance, active projects, and daily request volume.*

| Workspace Dashboard (Dark Mobile, 390px) | Project Management List |
|:---:|:---:|
| ![Dashboard Dark Mobile](../assets/screenshots/v7-dashboard-cs-dark-390.png) | ![SaaS Projects List](../assets/screenshots/saas-projects.png) |
| *Mobile dashboard with stacked metrics and action buttons* | *Multi-tenant project isolation and management* |

| Project Workspace (English Desktop, 1280px) | Mobile Project Workspace (Dark, 390px) |
|:---:|:---:|
| ![Workspace Desktop](../assets/screenshots/v7-workspace-en.png) | ![Workspace Mobile](../assets/screenshots/v7-workspace-mobile.png) |
| *Scoped project workspace with aligned actions* | *Compact project view optimized for mobile screens* |

### SaaS Workspace Overview
![SaaS Dashboard Overview](../assets/screenshots/saas-dashboard.png)
*Complete multi-tenant workspace overview.*

---

## 4. Developer Platform & Interactive API Tools

The developer suite includes comprehensive OpenAPI-compliant documentation, scoped API key provisioning with daily quotas, and an interactive browser-based API playground.

### Interactive API Playground (Czech, 1440px)
![Interactive API Playground](../assets/screenshots/v7-playground-cs-1440.png)
*Live API playground enabling developers to send test payloads and inspect formatted JSON responses.*

| Scoped API Key Management (1440px) | Mobile API Key Management (Dark, 390px) |
|:---:|:---:|
| ![API Keys Desktop](../assets/screenshots/v7-api-keys-cs-1440.png) | ![API Keys Dark Mobile](../assets/screenshots/v7-api-keys-cs-dark-390.png) |
| *API key generation with daily quotas, expiry, and lineage* | *Mobile API key controls with touch-optimized actions* |

| Developer API Reference (Dark Tablet, 1024px) | English Developer API Documentation (1024px) |
|:---:|:---:|
| ![Developer Docs Dark Tablet](../assets/screenshots/v7-developers-cs-dark-1024-a11y.png) | ![Developer Docs English Tablet](../assets/screenshots/v7-developers-en-1024.png) |
| *WCAG AA accessibility verified API reference* | *Comprehensive endpoint parameters and response schemas* |

| Documentation Hub (English, 1024px) | SaaS Developer Guide |
|:---:|:---:|
| ![Docs Hub](../assets/screenshots/v7-docs-en-1024.png) | ![SaaS Developer Guide](../assets/screenshots/saas-developers.png) |
| *Central documentation navigation center* | *SaaS developer onboarding guide* |

| Developer Guide (Dark Mode) | Developer Guide (Light Mode) |
|:---:|:---:|
| ![Developers Dark](../assets/screenshots/developers-dark.png) | ![Developers Light](../assets/screenshots/developers-light.png) |
| *Full dark theme code samples* | *Full light theme code samples* |

### SaaS API Key Provisioning
![SaaS API Keys](../assets/screenshots/saas-api-keys.png)
*Project-level credential generation with instant revocation.*

---

## 5. Authentication, Account Lifecycle & Security

Powered by Better Auth, the platform provides email verification, password recovery, session management, and root administrative access control.

| Dark Login Screen (Tablet, 1024px) | Mobile Registration (Czech, 390px) |
|:---:|:---:|
| ![Login Dark](../assets/screenshots/v7-login-en-dark-1024.png) | ![Signup Mobile](../assets/screenshots/v7-signup-cs-390.png) |
| *Secure authentication with password and magic link support* | *Mobile account registration flow* |

| Email Verification Flow | Password Recovery Flow |
|:---:|:---:|
| ![Verify Email](../assets/screenshots/saas-verify-email.png) | ![Password Recovery](../assets/screenshots/saas-password-recovery.png) |
| *Email confirmation prompt with token validation* | *Password reset workflow with secure one-time tokens* |

---

## 6. Metered Billing, Credits & Stripe Sandbox

Transactional credit accounting recorded in a double-entry PostgreSQL ledger, supporting one-time top-ups, recurring tiers, and Stripe checkout.

### Billing Management & Credit Ledger (Czech, 1440px)
![Billing Desktop](../assets/screenshots/v7-billing-cs-1440.png)
*Credit ledger interface with transaction history, auto-refill options, and payment method management.*

| Mobile Billing & Credits (Dark, 390px) | Stripe Sandbox Checkout |
|:---:|:---:|
| ![Billing Dark Mobile](../assets/screenshots/v7-billing-cs-dark-390.png) | ![Stripe Test Billing](../assets/screenshots/v7-stripe-test-billing.png) |
| *Mobile billing overview and credit top-up controls* | *Stripe test-mode checkout and webhook verification* |

| Pricing Tiers (Czech Desktop, 1440px) | Pricing Tiers (English Dark Mobile, 390px) |
|:---:|:---:|
| ![Pricing Desktop](../assets/screenshots/v7-pricing-cs-1440.png) | ![Pricing Dark Mobile](../assets/screenshots/v7-pricing-en-dark-390.png) |
| *Feature breakdown and tier selection on desktop* | *Responsive single-column pricing cards on mobile* |

| SaaS Billing Test Ledger | SaaS Pricing Overview |
|:---:|:---:|
| ![SaaS Billing Test](../assets/screenshots/saas-billing-test.png) | ![SaaS Pricing](../assets/screenshots/saas-pricing.png) |
| *PostgreSQL transactional ledger balance verification* | *Multi-tenant subscription tiers* |

---

## 7. Platform Administration & AI Studio (ROOT Only)

Restricted administrative operations console providing real-time metrics, audit logs, model registry controls, and the AI Studio prompt engineering environment.

### Platform Operations Overview (English Desktop, 1440px)
![Admin Overview English](../assets/screenshots/v7-admin-overview-en-1440.png)
*Platform admin console showing total tenants, active requests, error rates, and system health status.*

| Platform Operations Overview (Czech, 1440px) | Mobile Admin Overview (Dark, 390px) |
|:---:|:---:|
| ![Admin Overview Czech](../assets/screenshots/v7-admin-overview-cs-1440.png) | ![Admin Overview Dark Mobile](../assets/screenshots/v7-admin-overview-en-dark-390.png) |
| *Czech localized administrative console* | *Mobile operations overview with stacked status cards* |

### Multi-Tenant User Management & Credit Adjustments (1440px)
![Admin Users Directory](../assets/screenshots/v7-admin-users-en-1440.png)
*User search, role assignment, and manual credit balance adjustments with transactional audit logging.*

### AI Studio: Operational Traces & Atomic Budget Guards (Dark Mode)
![AI Studio Traces Dark](../assets/screenshots/v7-ai-studio-en-dark.png)
*Real-time trace logs detailing token consumption, latency, USD cost estimation, and PostgreSQL atomic budget enforcement.*

| AI Studio Traces (Light Mode, 1440px) | Prompt Lab & Rollback Management |
|:---:|:---:|
| ![AI Studio Traces Light](../assets/screenshots/v7-ai-studio-en-light.png) | ![Prompt Lab](../assets/screenshots/v7-prompt-lab.png) |
| *AI Studio trace table in light theme* | *Immutable prompt versioning with live testing and rollback* |

### Model Registry & Provider Health Checks
![Model Registry](../assets/screenshots/v7-model-registry.png)
*Configured OpenAI-compatible endpoints with automated health check status and model verification.*

---

## 8. Historical Archive & Interface Evolution

Preserved interface captures from earlier development milestones (v6 releases) documenting platform maturation.

| Historical Home (Czech Light, v6) | Historical Home (English Dark Mobile, v6) |
|:---:|:---:|
| ![v6 Czech Light Home](../assets/screenshots/v6-home-cs-light.png) | ![v6 English Dark Mobile](../assets/screenshots/v6-home-en-dark-mobile.png) |
| *v6 light landing interface* | *v6 dark mobile interface* |

| Historical Analysis (Dark, v6) | Historical Admin Settings (v6) |
|:---:|:---:|
| ![v6 Analysis Dark](../assets/screenshots/v6-analysis-en-dark.png) | ![v6 Admin Settings](../assets/screenshots/v6-admin-settings.png) |
| *Early analysis results display* | *Initial platform configuration screen* |

| Historical AI Trace Log (v6) | SaaS Mobile Landing Exploration |
|:---:|:---:|
| ![v6 AI Traces](../assets/screenshots/v6-ai-traces.png) | ![SaaS Home Mobile](../assets/screenshots/saas-home-mobile.png) |
| *Preliminary trace recording interface* | *Early mobile layout prototype* |

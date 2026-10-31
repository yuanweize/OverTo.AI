# Security Policy & Deployment Guidelines

## Security Invariants

1. **Deterministic Scam & Threat Analysis**: Input messages are parsed locally. PII redaction previews are computed deterministically. The application does not visit untrusted target URLs and does not persist unredacted message text in PostgreSQL databases.
2. **AI Inference & Spending Gate**: In production environments, direct public model invocations remain gated behind `deployment_gate` (`AI_LOCAL_ONLY=true`). In self-hosted setups with explicit opt-in, model calls require configured endpoints, strict structured schemas, full worst-case cost reservations, model cost ceilings, and fail-closed budget limits (`AiBudgetGuard` with advisory locks).
3. **Client Identity & Anti-Abuse Protection**: Client identities are hashed with a cryptographically secure salt (`OVERTO_CLIENT_IDENTITY_SALT`). When deploying behind reverse proxies, `OVERTO_TRUST_PROXY=true` requires verified socket peer IPs or `OVERTO_TRUSTED_PROXY_SECRET`. Unverified direct requests cannot evade rate limits by rotating headers; all untrusted requests map to a conservative shared bucket (`direct-untrusted-client`).
4. **Credential Isolation & Secret Scanning**: Database credentials, SMTP secrets, and API keys must never be committed to Git. Automated secret scanning (`npm run secrets:check`) runs in CI on every push and pull request. Integration tests connect exclusively to dedicated, isolated test databases (`overto_test`) with strict identity verification.
5. **Account Lifecycle & Data Portability**: Account data exports (`/api/account/export`) support standard browser same-origin requests, reject cross-site invocations, and provide full historical records without arbitrary truncation. Account deletion (`/api/account/delete`) enforces password re-authentication, blocks root admin deletion, revokes all active sessions and keys, and cleans up workspace data within an atomic transaction.

## Reporting a Vulnerability

For responsible disclosure, please contact the maintainer through GitHub Security Advisories or private security channels. Do not file public issues for unpatched vulnerabilities.

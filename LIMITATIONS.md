# Limitations & Operational Boundaries

OvěřTo.AI is an evidence-led assistance tool, not an infallible security oracle. Operators, developers, and end users should understand the following technical and operational boundaries:

## 1. No Guarantee of Accuracy
- **Heuristic Nature:** Both deterministic rules and optional LLM proposals are heuristic. The platform cannot guarantee detection of all scam messages, nor does it guarantee that benign messages will never trigger warnings.
- **Evolving Threats:** Deceptive phrasing, novel social engineering techniques, and zero-day phishing infrastructure can evade pattern matching and offline heuristics.
- **Never a Certificate of Safety:** An `INSUFFICIENT_EVIDENCE` or low-risk assessment must **never** be interpreted as proof that a message or request is safe. Users must always verify unexpected or urgent requests through trusted out-of-band channels.

## 2. Privacy & Data Redaction Limits
- **Best-Effort Scrubbing:** Client-side PII masking targets standard phone numbers, emails, and common Czech/English naming patterns. It cannot detect all forms of identifying context (such as unique reference numbers, uncommon names, or domain specifics).
- **URL Host Visibility:** Domain names extracted from URLs are analyzed for spoofing and homoglyphs. In AI-enabled mode, domain names remaining in reviewed text are transmitted to the configured model provider.

## 3. Production AI Gating & Local Defaults
- **Rules-Only Production Default:** Public container images and production deployment blueprints default to deterministic **Rules-only** mode (`AI_LOCAL_ONLY`). External LLM calls are disabled by default to prevent unexpected API costs or external data transit.
- **Provider Autonomy:** When external AI is enabled, inference quality, uptime, and retention policies depend on the operator's chosen OpenAI-compatible provider. The platform enforces schema conformance and verbatim quotation checks, but cannot guarantee the semantic correctness of model-generated text.

## 4. Offline URL Analysis
- **No Active Crawling:** OvěřTo.AI intentionally performs only offline lexical analysis of URLs (inspecting TLDs, IP formats, unicode confusables, and subdomains). It does not fetch remote HTML, resolve external DNS records, or execute remote JavaScript. Consequently, it cannot detect server-side redirects or cloaked phishing destinations.

## 5. Self-Hosting Responsibilities
- **Infrastructure Security:** Self-hosted deployments require operators to manage secure PostgreSQL instances, configure trusted reverse proxies (`TRUSTED_PROXY_HOPS`) for accurate rate limiting, provide dedicated SMTP credentials, and maintain operational backups.

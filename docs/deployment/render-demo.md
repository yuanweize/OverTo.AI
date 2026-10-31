# Render + Managed PostgreSQL Public Demo Deployment Guide

This guide documents the setup for running an OvěřTo.AI public demo instance on [Render](https://render.com) backed by managed PostgreSQL, with Cloudflare custom subdomain routing and automated continuous deployment from the GitHub `main` branch.

---

## 1. Safety & Demo Invariants

The public demo configuration (`render.yaml`) enforces the following security boundaries:

- **Rules-Only Deterministic Analysis**: Paid LLM calls are disabled (`AI_ENABLED=false`, `AI_LOCAL_ONLY=false`). Public analysis uses deterministic scam pattern matching and offline URL verification with zero third-party provider costs.
- **Zero Real Billing**: Real Stripe checkout is disabled (`STRIPE_SECRET_KEY=""`), preventing unintended customer payments.
- **Client Identity & Anti-Abuse**: `OVERTO_TRUST_PROXY=true` preserves client IP hashing behind Cloudflare and Render proxies, preventing rate-limit circumvention while protecting user privacy.
- **High-Entropy Generated Secrets**: Critical secrets (`OVERTO_AUTH_SECRET`, `OVERTO_CLIENT_IDENTITY_SALT`) are generated dynamically by Render on initialization and never committed to version control.
- **EU Data Residency**: Deployed in the Frankfurt region (`frankfurt`), ensuring GDPR compliance and low latency for Czech and EU users.

---

## 2. Infrastructure as Code (`render.yaml`)

The repository root contains `render.yaml`, an official Render Blueprint:

- **Web Service (`overto-ai-demo`)**: Runs the production Docker image built from `./Dockerfile` (Next.js 16 standalone output).
- **PostgreSQL Database (`overto-db`)**: Managed PostgreSQL instance in the Frankfurt region. Connection strings (`DATABASE_URL` and `OVERTO_DATABASE_URL`) are automatically injected by Render.
- **Continuous Deployment**: `autoDeploy: true` automatically triggers deployment when commits pass GitHub Actions CI on the `main` branch.
- **Health Verification**: Periodically monitors `/api/v1/health` to confirm container readiness before swapping traffic.

---

## 3. Step-by-Step Deployment Instructions

### Step 1: Create Blueprint Instance on Render

1. Log in to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** $\rightarrow$ **Blueprint**.
3. Connect your GitHub repository (`yuanweize/OverTo.AI`).
4. Select the `main` branch. Render will detect `render.yaml`.
5. Name the service group (e.g., `overto-ai-production`) and click **Apply**.

### Step 2: Configure Environment Secrets in Render Dashboard

Fill in the uncommitted environment variables (`sync: false`) in the Render Web Service settings:

| Variable | Recommended Value / Description |
| :--- | :--- |
| `BETTER_AUTH_URL` | Your full HTTPS domain (e.g. `https://demo.overto.ai`) |
| `OVERTO_SMTP_HOST` | Production SMTP host (e.g. `smtp.resend.com` or `smtp.eu.mailgun.org`) |
| `OVERTO_SMTP_PORT` | `587` |
| `OVERTO_SMTP_USER` | SMTP username provided by your email provider |
| `OVERTO_SMTP_PASSWORD` | SMTP password / API token |
| `OVERTO_SMTP_FROM` | Verified sender address (e.g. `OvěřTo.AI <noreply@overto.ai>`) |

*(Never commit real SMTP passwords or API tokens to the GitHub repository).*

### Step 3: Configure Cloudflare Custom Subdomain

To attach a custom domain (e.g., `demo.overto.ai`):

1. In Render, navigate to **Settings** $\rightarrow$ **Custom Domains** $\rightarrow$ **Add Custom Domain**.
2. Enter your chosen subdomain: `demo.overto.ai`.
3. Render will provide a target CNAME (e.g., `overto-ai-demo.onrender.com`).
4. In your [Cloudflare Dashboard](https://dash.cloudflare.com/):
   - Navigate to **DNS** $\rightarrow$ **Records**.
   - Add a `CNAME` record:
     - **Name**: `demo`
     - **Target**: `overto-ai-demo.onrender.com`
     - **Proxy status**: Proxied (Orange Cloud) for Cloudflare DDoS protection and Edge SSL.
5. In Cloudflare **SSL/TLS**: Ensure encryption mode is set to **Full (strict)**.

### Step 4: Bootstrap the Initial Administrator

Once the web service and database are active and migrations have run:

1. In the Render Dashboard, open the `overto-ai-demo` service.
2. Navigate to **Shell** or use **One-Off Job**:
   ```sh
   ./node_modules/.bin/tsx scripts/bootstrap-admin.ts admin@yourdomain.com
   ```
3. Copy the generated one-time administrative activation token to sign in.

---

## 4. Verification & Health Checklist

After deployment completes:

1. **System Health**: Visit `https://<your-subdomain>/api/v1/health` $\rightarrow$ must return `{"status":"ok","service":"overto","schemaVersion":"1.0"}` with HTTP 200.
2. **Site Configuration**: Visit `https://<your-subdomain>/api/site` $\rightarrow$ must return localized branding configuration.
3. **Rules Engine Verification**: Submit a sample Czech message on the home page $\rightarrow$ must produce immediate deterministic risk evaluation with redacting preview.
4. **Rate Limiting**: Rapid consecutive requests should receive HTTP 429 with `Retry-After` headers without application crashes.

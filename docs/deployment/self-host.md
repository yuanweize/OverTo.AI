# Self-Hosting Guide — OvěřTo.AI Production SaaS

This guide explains how to install, configure, verify, backup, restore, and upgrade a production self-hosted installation of OvěřTo.AI using Docker Compose and PostgreSQL.

## Port Allocation Matrix

To prevent port conflicts when running both local development servers and Docker Compose simultaneously, OvěřTo.AI adheres to the following port convention:

| Environment | Service | Host Binding | Internal Port | Description |
|---|---|---|---|---|
| **Local Dev** | Next.js Server | `127.0.0.1:3005` | `3005` | Started via `npm run dev -- -p 3005` |
| **Local Dev** | Mailpit Web UI | `127.0.0.1:8025` | `8025` | Local developer email inbox |
| **Local Dev** | Mailpit SMTP | `127.0.0.1:1025` | `1025` | Local SMTP for magic links |
| **Local Dev** | Test PostgreSQL | `127.0.0.1:55443` | `5432` | Disposable dev database |
| **Self-Host Compose** | OverTo App | `127.0.0.1:3006` | `3000` | Production Next.js web application |
| **Self-Host Compose** | PostgreSQL | `127.0.0.1:5432` | `5432` | SaaS persistent database |
| **Self-Host Compose** | Mailpit Web UI | `127.0.0.1:8026` | `8025` | Self-host email testing (`--profile test-mail`) |
| **Self-Host Compose** | Mailpit SMTP | `mailpit:1025` | `1025` | Internal Docker bridge SMTP |

## Architecture Overview

A self-hosted deployment consists of:

1. **Next.js Application** (`app`): Serves the frontend, API, and background processes in standalone container mode on port `3006`.
2. **PostgreSQL** (`postgres`): PostgreSQL 17 database storing accounts, workspaces, projects, rate limits, credit ledger, atomic AI reservations, and AI trace metadata.
3. **Automated Migrator** (`migrate`): Runs before the application starts, executing all versioned schema migrations (`migrations/001_...` through `016_...`) idempotently.
4. **SMTP Service**: Any standard RFC 5321 SMTP server for sending email verification and password reset links (or Mailpit on port `8026` via `--profile test-mail`).

## Prerequisites

- Docker 24.0+ and Docker Compose v2.20+
- A domain name with SSL certificate (HTTPS required for production cookies)
- An outbound SMTP provider (SendGrid, Postmark, AWS SES, or custom SMTP)

## Quick Start

### 1. Configuration

Copy the example environment file:

```sh
cp .env.selfhost.example .env.selfhost
```

Edit `.env.selfhost` with production secrets:

```ini
OVERTO_SELF_HOSTED=true
OVERTO_DB_PASSWORD=<generate-strong-64-char-password>
OVERTO_DATABASE_URL=postgresql://overto:<password>@postgres:5432/overto
OVERTO_AUTH_SECRET=<generate-strong-64-char-secret>
BETTER_AUTH_URL=https://overto.yourdomain.com
OVERTO_PUBLIC_URL=https://overto.yourdomain.com
OVERTO_HOST_PORT=3000
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_FROM=no-reply@yourdomain.com
SMTP_USER=smtp-user
SMTP_PASSWORD=smtp-password
AI_ENABLED=false
```

### 2. Launch Services

Start the containers:

```sh
docker compose --env-file .env.selfhost -f compose.saas.yaml up -d --build
```

Compose automatically waits for PostgreSQL to become healthy, runs `scripts/migrate-selfhost.ts`, and launches the Next.js application.

### 3. Verify Health Check

Query the health endpoint:

```sh
curl -i https://overto.yourdomain.com/api/v1/health
```

Expected response: `HTTP 200` with JSON `{ "status": "ok", "service": "overto", "schemaVersion": "1.0" }`.

### 4. Bootstrap Platform Administrator

Register an account via `/signup` and verify the email link. Then run:

```sh
docker compose --env-file .env.selfhost -f compose.saas.yaml run --rm --no-deps migrate \
  ./node_modules/.bin/tsx scripts/bootstrap-admin.ts admin@yourdomain.com
```

The specified user now has `ROOT` access to `/admin` (operations overview, audit log, credit management, and AI Studio).

## Backup & Recovery

### Automated Backup

Create a point-in-time PostgreSQL dump:

```sh
docker compose --env-file .env.selfhost -f compose.saas.yaml exec -T postgres \
  pg_dump -U overto -d overto -F c -f /tmp/backup.dump
```

Copy the dump out of the container:

```sh
docker compose --env-file .env.selfhost -f compose.saas.yaml cp postgres:/tmp/backup.dump ./backup-$(date +%Y%m%d).dump
```

### Restoration Verification

To verify that backups restore accurately into an independent database:

```sh
# Automated verification test script:
npx tsx scripts/test-backup-restore.ts
```

This script generates synthetic records, creates a dump, restores into a new disposable database, verifies record counts and schema equivalence, and cleans up.

## Upgrades

1. Pull or build the latest release image.
2. Run migrations:
   ```sh
   docker compose --env-file .env.selfhost -f compose.saas.yaml run --rm --no-deps migrate
   ```
3. Restart the application service:
   ```sh
   docker compose --env-file .env.selfhost -f compose.saas.yaml up -d --no-deps app
   ```

All database migrations are idempotent and backward-compatible.

## Reverse Proxy & Security Hardening

When deploying behind reverse proxies (Cloudflare, Nginx, Caddy, AWS ALB):
- Set `OVERTO_TRUST_PROXY=true` ONLY if the proxy strips unverified client headers and provides genuine `cf-connecting-ip` / `x-forwarded-for` headers.
- If directly exposed without an external filtering proxy, leave `OVERTO_TRUST_PROXY=false` so spoofed headers are safely discarded.
- Supply `OVERTO_CLIENT_IDENTITY_SALT` with a high-entropy string (min 32 bytes) to salt client IP hashes.

## GitHub Container Registry (GHCR)

Pre-built production multi-arch images (`linux/amd64`, `linux/arm64`) are published to GHCR:

```sh
docker pull ghcr.io/yuanweize/overto.ai:7.0.1
docker pull ghcr.io/yuanweize/overto.ai:latest
```

To build and push manually using a GitHub Personal Access Token (classic):
1. Ensure the token has `write:packages` and `read:packages` permissions.
2. Log in:
   ```sh
   echo "$GITHUB_PAT" | docker login ghcr.io -u <YOUR_GITHUB_USERNAME> --password-stdin
   ```
3. Build and push:
   ```sh
   docker buildx build --platform linux/amd64,linux/arm64 \
     -t ghcr.io/yuanweize/overto.ai:7.0.1 \
     -t ghcr.io/yuanweize/overto.ai:latest --push .
   ```

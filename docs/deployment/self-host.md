# Self-Hosting Guide — OvěřTo.AI Production SaaS

This guide explains how to install, configure, verify, backup, restore, and upgrade a production self-hosted installation of OvěřTo.AI using Docker Compose and PostgreSQL.

## Architecture Overview

A self-hosted deployment consists of:

1. **Next.js Application** (`app`): Serves the frontend, API, and background processes in standalone container mode.
2. **PostgreSQL** (`postgres`): PostgreSQL 17 database storing accounts, workspaces, projects, rate limits, credit ledger, and AI trace metadata.
3. **Automated Migrator** (`migrate`): Runs before the application starts, executing all versioned schema migrations (`migrations/001_...` through `015_...`) idempotently.
4. **SMTP Service**: Any standard RFC 5321 SMTP server for sending email verification and password reset links (or Mailpit in development).

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

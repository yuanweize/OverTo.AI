# Deployment acceptance plan

The present `compose.yaml` runs a rules-only loopback container. It does not deliver account, email or billing services. Treat the full SaaS deployment gate as **not passed**.

## Current container smoke

Build with `docker compose build`, start with `docker compose up -d`, then check `http://127.0.0.1:3006/api/v1/health` and make a synthetic rules request to `/api/v1/analyses`. Use `docker compose down` after the smoke; no named PostgreSQL volume exists in this prototype. Docker build success alone is not an application acceptance result.

## Required full SaaS gate

Use a fresh, named, isolated PostgreSQL volume and test-only SMTP service. Never reuse the valuable local account volume. Validate database migration, administrator bootstrap, signup and verified login, project creation, API key, rules analysis, usage/credit persistence across restart, root settings, backup and restore, and a rollback rehearsal. Verify HTTPS behind the chosen proxy, secure cookies, trusted client identity, distributed anonymous admission, provider budget fail-closed behavior, health/readiness, and secret injection. Document upgrade from one version to the next and pull a published GHCR digest before calling self-hosting complete. No such deployment is currently verified.

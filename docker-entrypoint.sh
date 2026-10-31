#!/bin/sh
set -e

# If self-hosted mode is enabled and OVERTO_DATABASE_URL is provided,
# automatically run database schema migrations before starting the application server.
if [ "$OVERTO_SELF_HOSTED" = "true" ] && [ -n "$OVERTO_DATABASE_URL" ] && [ "$OVERTO_SKIP_AUTO_MIGRATE" != "true" ]; then
  echo "[OvěřTo Startup] Running database schema migrations..."
  node scripts/migrate.cjs || {
    echo "[OvěřTo Startup] Database migration failed!"
    exit 1
  }
  echo "[OvěřTo Startup] Database schema is ready."
fi

exec "$@"


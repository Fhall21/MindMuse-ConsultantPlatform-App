#!/bin/sh

set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

MAX_ATTEMPTS="${DB_MIGRATION_MAX_ATTEMPTS:-20}"
RETRY_DELAY_SECONDS="${DB_MIGRATION_RETRY_DELAY_SECONDS:-5}"

attempt=1
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  echo "Running Drizzle migrations (attempt $attempt/$MAX_ATTEMPTS)..."

  if bun run db/migrate.ts; then
    echo "Drizzle migrations applied successfully."
    touch /tmp/db-migrate-ready
    tail -f /dev/null
  fi

  if [ "$attempt" -eq "$MAX_ATTEMPTS" ]; then
    echo "Failed to apply Drizzle migrations after $MAX_ATTEMPTS attempts." >&2
    exit 1
  fi

  attempt=$((attempt + 1))
  echo "Retrying in $RETRY_DELAY_SECONDS seconds..."
  sleep "$RETRY_DELAY_SECONDS"
done

#!/bin/sh

set -eu

cd /workspace

if [ -z "${MIGRATION_DATABASE_URL:-}" ]; then
  echo "MIGRATION_DATABASE_URL is required" >&2
  exit 1
fi

AUTO_APPLY="${MIGRATION_AUTO_APPLY:-true}"
INCLUDE_SEED="${MIGRATION_INCLUDE_SEED:-false}"
MAX_ATTEMPTS="${MIGRATION_MAX_ATTEMPTS:-20}"
RETRY_DELAY_SECONDS="${MIGRATION_RETRY_DELAY_SECONDS:-5}"

run_push() {
  if [ "$INCLUDE_SEED" = "true" ]; then
    ./node_modules/.bin/supabase db push --db-url "$MIGRATION_DATABASE_URL" --include-seed
    return
  fi

  ./node_modules/.bin/supabase db push --db-url "$MIGRATION_DATABASE_URL"
}

if [ "$AUTO_APPLY" != "true" ]; then
  echo "Migration runner ready. AUTO_APPLY is disabled."
  touch /tmp/migrate-ready
  tail -f /dev/null
fi

attempt=1
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  echo "Running database migrations (attempt $attempt/$MAX_ATTEMPTS)..."

  if run_push; then
    echo "Database migrations applied successfully."
    touch /tmp/migrate-ready
    tail -f /dev/null
  fi

  if [ "$attempt" -eq "$MAX_ATTEMPTS" ]; then
    echo "Failed to apply database migrations after $MAX_ATTEMPTS attempts." >&2
    exit 1
  fi

  attempt=$((attempt + 1))
  echo "Retrying in $RETRY_DELAY_SECONDS seconds..."
  sleep "$RETRY_DELAY_SECONDS"
done

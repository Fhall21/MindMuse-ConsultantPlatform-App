#!/bin/sh

set -eu

echo "Running Drizzle migrations..."
bun run db/migrate.ts
echo "Drizzle migrations applied successfully."

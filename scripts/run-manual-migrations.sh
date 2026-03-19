#!/bin/sh

set -eu

if [ -z "${MIGRATION_NETWORK:-}" ]; then
  echo "MIGRATION_NETWORK is required" >&2
  exit 1
fi

if [ -z "${DATABASE_HOST:-}" ]; then
  echo "DATABASE_HOST is required" >&2
  exit 1
fi

if [ -z "${DATABASE_PORT:-}" ]; then
  echo "DATABASE_PORT is required" >&2
  exit 1
fi

if [ -z "${DATABASE_NAME:-}" ]; then
  echo "DATABASE_NAME is required" >&2
  exit 1
fi

if [ -z "${DATABASE_USER:-}" ]; then
  echo "DATABASE_USER is required" >&2
  exit 1
fi

if [ -z "${DATABASE_PASSWORD:-}" ]; then
  echo "DATABASE_PASSWORD is required" >&2
  exit 1
fi

IMAGE_TAG="${MIGRATION_IMAGE_TAG:-consultant-platform-migrate}"

docker build -f db/Dockerfile.migrations -t "$IMAGE_TAG" .

docker run --rm \
  --network "$MIGRATION_NETWORK" \
  -e DATABASE_HOST="$DATABASE_HOST" \
  -e DATABASE_PORT="$DATABASE_PORT" \
  -e DATABASE_NAME="$DATABASE_NAME" \
  -e DATABASE_USER="$DATABASE_USER" \
  -e DATABASE_PASSWORD="$DATABASE_PASSWORD" \
  -e NODE_ENV=production \
  "$IMAGE_TAG"

# ConsultantPlatform

Psychosocial consultation evidence platform. Turn post-interview admin into a repeatable evidence workflow: transcript capture, theme clarification, person linking, and evidence email generation.

Design source of truth: [DESIGN.md](./DESIGN.md)

## Stack

- Next.js 16 + React 19
- PostgreSQL 15
- Drizzle ORM + generated SQL migrations
- Better Auth for email/password auth and sessions
- FastAPI AI sidecar for extraction and drafting

## Prerequisites

- Bun 1.1+
- Python 3.12+
- Docker & Docker Compose

## Local Development

### 1. Set environment variables

```bash
cp .env.example .env
```

Fill in at least:
- `OPENAI_API_KEY`
- `BETTER_AUTH_SECRET`
- `APP_SITE_URL`

### 2. Start PostgreSQL

```bash
docker compose up db -d
```

### 3. Install dependencies and run migrations

```bash
bun install
bun run db:migrate
```

### 4. Start the app

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Start the AI service

```bash
cd services/ai
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Docker Compose

```bash
docker compose up
```

This starts:
- `db` on port `5432`
- `migrate` as a manual migration shell
- `app` on port `3000`
- `ai` on port `8000`

## Coolify Deployment

Deploy this repository as a single Docker Compose application using [docker-compose.coolify.yml](/Users/felixhall/Documents/0.WorkLife/MindMuse/2026/Product/Customer/ConsultantPlatform/ConsultantPlatformApp/docker-compose.coolify.yml).

Required environment variables:
- `APP_SITE_URL=https://app.example.com`
- `BETTER_AUTH_SECRET=<long random secret>`
- `DATABASE_PASSWORD=<postgres password>`
- `OPENAI_API_KEY=<your key>`
- `ALLOWED_ORIGINS=https://app.example.com`

Recommended defaults:
- `APP_PORT=3000`
- `AI_SERVICE_PORT=8000`
- `AI_SERVICE_URL=http://ai:8000`
- `DATABASE_NAME=consultant_platform`
- `DATABASE_USER=postgres`

Optional database override:
- `DATABASE_HOST=db`
- `DATABASE_PORT=5432`
- `DATABASE_NAME=consultant_platform`
- `DATABASE_USER=postgres`
- `DATABASE_PASSWORD=<password>`
- To point at a different database, change those values explicitly.
- If `AI_SERVICE_URL` is unset, the stack falls back to the internal `ai` service URL.

Notes:
- The included `db` service runs PostgreSQL inside the stack.
- You only configure `DATABASE_*` vars in this project. Compose maps them onto the Postgres image's internal `POSTGRES_*` vars for the `db` container.
- The included `migrate` service is a manual migration shell. It stays running, is excluded from Coolify's overall healthchecks, and is intended to be used through the Coolify terminal.
- The app and migration code now prefer `DATABASE_HOST` / `DATABASE_PORT` / `DATABASE_NAME` / `DATABASE_USER` / `DATABASE_PASSWORD` over `DATABASE_URL`, so a stale `DATABASE_URL` env var cannot silently redirect the connection.
- Keep the `ai` service private and only expose the `app` service publicly.
- The app image now receives its required auth/database env values at build time as well as runtime, which is necessary for `next build`.

Validate the local stack before deploy:

```bash
docker compose config
```

Note: [docker-compose.coolify.yml](/Users/felixhall/Documents/0.WorkLife/MindMuse/2026/Product/Customer/ConsultantPlatform/ConsultantPlatformApp/docker-compose.coolify.yml) contains Coolify's `exclude_from_hc` extension for the manual `migrate` service, so standard local `docker compose config` will not understand that file.

## Database Workflow

- Generate migration SQL: `bun run db:generate`
- Apply migrations: `bun run db:migrate`
- Push schema directly in dev: `bun run db:push`
- Open Drizzle Studio: `bun run db:studio`

### Manual Migrations On The Coolify Server

Open the terminal for the `migrate` service in Coolify and run:

```bash
bun run db/migrate.ts
```

The `migrate` container already has:
- the checked-in `drizzle/` migrations
- the DB schema files
- Bun installed
- the same `DATABASE_HOST` / `DATABASE_PORT` / `DATABASE_NAME` / `DATABASE_USER` / `DATABASE_PASSWORD` env vars as the app stack

If you want to inspect connectivity first, run:

```bash
bun -e "import { Client } from 'pg'; const client = new Client({ host: process.env.DATABASE_HOST, port: Number(process.env.DATABASE_PORT), database: process.env.DATABASE_NAME, user: process.env.DATABASE_USER, password: process.env.DATABASE_PASSWORD }); await client.connect(); console.log('db ok'); await client.end();"
```

The generated SQL lives in [`drizzle/`](/Users/felixhall/Documents/0.WorkLife/MindMuse/2026/Product/Customer/ConsultantPlatform/ConsultantPlatformApp/drizzle).

## Project Structure

```text
app/                    Next.js App Router pages
  (auth)/               Login, callback
  (app)/                Authenticated shell
  api/auth/             Better Auth route handlers
components/             UI and feature components
db/                     Drizzle client, schema, migration runner
drizzle/                Generated SQL migrations
hooks/                  TanStack Query wrappers
lib/auth/               Better Auth helpers and session access
lib/openai/             AI service client
lib/validations/        Zod schemas
services/ai/            FastAPI AI sidecar
types/                  Shared TypeScript types
```

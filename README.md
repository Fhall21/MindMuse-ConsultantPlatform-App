# ConsultantPlatform

Psychosocial consultation evidence platform. Turn post-interview admin into a repeatable evidence workflow: transcript capture, theme clarification, person linking, and evidence email generation.

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
- `migrate` to apply Drizzle migrations
- `app` on port `3000`
- `ai` on port `8000`

## Coolify Deployment

Deploy this repository as a single Docker Compose application using [docker-compose.coolify.yml](/Users/felixhall/Documents/0.WorkLife/MindMuse/2026/Product/Customer/ConsultantPlatform/ConsultantPlatformApp/worktrees/stage5-integration/docker-compose.coolify.yml).

Required environment variables:
- `APP_SITE_URL=https://app.example.com`
- `BETTER_AUTH_SECRET=<long random secret>`
- `DATABASE_PASSWORD=<postgres password>`
- `OPENAI_API_KEY=<your key>`
- `ALLOWED_ORIGINS=https://app.example.com`

Recommended defaults:
- `APP_PORT=3000`
- `AI_SERVICE_PORT=8000`
- `DATABASE_NAME=consultant_platform`
- `DATABASE_USER=postgres`

Notes:
- The included `db` service runs PostgreSQL inside the stack.
- The included `migrate` service applies checked-in Drizzle migrations before the app starts.
- Keep the `ai` service private and only expose the `app` service publicly.

Validate the stack before deploy:

```bash
docker compose -f docker-compose.coolify.yml config
```

## Database Workflow

- Generate migration SQL: `bun run db:generate`
- Apply migrations: `bun run db:migrate`
- Push schema directly in dev: `bun run db:push`
- Open Drizzle Studio: `bun run db:studio`

The generated SQL lives in [`drizzle/`](/Users/felixhall/Documents/0.WorkLife/MindMuse/2026/Product/Customer/ConsultantPlatform/ConsultantPlatformApp/worktrees/stage5-integration/drizzle).

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

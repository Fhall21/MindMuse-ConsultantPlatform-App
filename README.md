# ConsultantPlatform

Psychosocial consultation evidence platform. Turn post-interview admin into a repeatable evidence workflow: transcript capture, theme clarification, person linking, and evidence email generation.

## Prerequisites

- Bun 1.1+
- Python 3.12+
- Docker & Docker Compose
- Supabase CLI (`brew install supabase/tap/supabase`)

## Local Development Setup

### 1. Environment variables

```bash
cp .env.example .env
# Set OPENAI_API_KEY and verify AI_SERVICE_URL
```

### 2. Start Supabase locally

```bash
supabase start
# Copy API URL, anon key, and service_role key from output into .env
```

Local auth emails are captured by Supabase's built-in email testing server instead of being delivered to a real inbox.
Open the inbox at http://localhost:54324 after signing up to inspect confirmation links.

Expected local values:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start>
```

### 3. Run database migrations

```bash
supabase db reset
# Or: supabase migration up
```

### 4. Start the Next.js app

```bash
bun install
bun run dev
# Open http://localhost:3000
```

### 5. Start the AI service

```bash
cd services/ai
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Docker Compose (all services)

```bash
docker compose up
```

This starts:
- **app** — Next.js on port 3000
- **ai** — FastAPI on port 8000
- **db** — PostgreSQL 15 on port 5432

## Coolify Deployment (Compose Service Stack)

This repository now includes a dedicated Coolify stack file: `docker-compose.coolify.yml`.
Keep local development on `docker-compose.yml` and use the Coolify file only for deployment.

### 1. In Coolify, create a Docker Compose Service Stack

- Select this repository and branch.
- Set Compose file path to `ConsultantPlatformApp/docker-compose.coolify.yml`.
- Use standard Compose Service Stack mode (not Raw Compose Deployment).

### 2. Set environment variables in a single Coolify panel

The stack uses Compose interpolation so Coolify can validate required values.

Required values:

- `APP_SITE_URL`
- `SUPABASE_PUBLIC_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `POSTGRES_PASSWORD`
- `OPENAI_API_KEY`

Recommended defaults:

- `APP_PORT=3000`
- `AI_SERVICE_PORT=8000`
- `SUPABASE_JWT_EXP=3600`
- `POSTGRES_DB=postgres`
- `OPENAI_MODEL=gpt-4o-mini`
- `OPENAI_VISION_MODEL=gpt-4o`
- `OPENAI_AUDIO_MODEL=whisper-1`
- `ALLOWED_ORIGINS=https://your-app-domain`
- `GOTRUE_DISABLE_SIGNUP=false`
- `GOTRUE_MAILER_AUTOCONFIRM=true`

Use `SUPABASE_PUBLIC_URL` as the single public Supabase endpoint for both the app client config and Supabase auth site URL. You still set the actual public domain once in Coolify, but the stack reuses it everywhere else.

### 3. Domain routing and service exposure

- Assign your public app domain to the `app` service using container port `3000`.
- Assign a separate public domain to `supabase-kong` if browser clients should call Supabase APIs directly.
- Do not expose `db`, `ai`, `supabase-auth`, `supabase-rest`, or `supabase-meta` directly.

### 4. Validate before first deploy

From this directory:

```bash
docker compose -f docker-compose.coolify.yml config
```

If interpolation succeeds, deploy in Coolify and verify:

- app health endpoint responds through your domain
- AI health endpoint is healthy internally
- signup/login and consultation data reads/writes work
- theme/email generation requests reach the AI service

## Supabase Local Notes

- Supabase Studio is available at `http://localhost:54323`.
- Use `supabase db reset` for a clean local rebuild (migrations + seed).
- Use `supabase migration up` when you only want pending migrations.

## Project Structure

```
app/                    Next.js App Router pages
  (auth)/               Login, callback (unauthenticated)
  (app)/                Authenticated shell with sidebar
    dashboard/
    consultations/[id]/
    people/
    settings/
  api/auth/             Supabase Auth route handlers
components/
  ui/                   Shadcn UI components
  layout/               Shell, sidebar, nav
lib/
  supabase/             Supabase client (browser + server)
  openai/               AI service client
  validations/          Zod schemas
services/ai/            FastAPI AI sidecar
supabase/migrations/    PostgreSQL migrations
```

## Tech Stack

- **Frontend:** Next.js 14+, React, Tailwind CSS, Shadcn UI, TanStack Query, TanStack Table, React Hook Form + Zod
- **Database:** Supabase (PostgreSQL) — portable to plain PostgreSQL
- **AI Service:** FastAPI + OpenAI GPT-4o
- **Containerisation:** Docker Compose

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

## Coolify Deployment (Recommended)

Use two separate Coolify resources:

1. A dedicated **Supabase** service using Coolify's one-click Supabase template.
2. This repository as a separate **Docker Compose application** using `docker-compose.coolify.yml`.

This is the safest production shape because local `supabase start` is a dev-only stack, while self-hosted Supabase on Coolify has its own API gateway, Postgres initialization, and auth/runtime wiring.

### 1. Deploy Supabase first

Create a Supabase service in Coolify and give it its own public domain, for example:

- App: `https://app.example.com`
- Supabase API gateway: `https://supabase.example.com`

In the Supabase service, make sure these values line up:

- `SUPABASE_PUBLIC_URL=https://supabase.example.com`
- `API_EXTERNAL_URL=https://supabase.example.com`
- `SITE_URL=https://app.example.com`
- `ADDITIONAL_REDIRECT_URLS=https://app.example.com/callback`

For email sign-up to work in production, also configure SMTP in the Supabase service.
If you are only doing internal testing first, you can temporarily enable email autoconfirm instead.

If you later add Google/GitHub OAuth, the provider callback URL should point to:

- `https://supabase.example.com/auth/v1/callback`

You will also need the Supabase `anon` key and `service_role` key from that service for the app deployment.

### 2. Apply this repo's migrations to the self-hosted database

This repository now includes a dedicated migration runner service in `docker-compose.coolify.yml`.
It uses the checked-in `supabase/` directory plus the Supabase CLI already listed in `package.json`.

Set this env var on the app stack:

- `MIGRATION_DATABASE_URL=<postgres connection string>`

Recommended options for that connection string:

- direct internal Postgres connection on port `5432`
- or Supavisor session mode on port `5432` if direct Postgres is not reachable from the app stack

Supabase's docs recommend direct connections for long-lived services, and session-mode pooler as the fallback when direct routing is not available.

If your Supabase resource is deployed in another Coolify stack, enable `Connect to Predefined Network` on this app stack and use the renamed internal hostname Coolify gives the database service, such as `postgres-<uuid>`.

From `ConsultantPlatformApp/`:

```bash
supabase db push --db-url 'postgres://postgres:<PASSWORD>@<HOST>:5432/postgres'
```

To seed local reference data as well:

```bash
supabase db push --db-url 'postgres://postgres:<PASSWORD>@<HOST>:5432/postgres' --include-seed
```

Useful checks:

```bash
supabase migration list --db-url 'postgres://postgres:<PASSWORD>@<HOST>:5432/postgres'
supabase db push --db-url 'postgres://postgres:<PASSWORD>@<HOST>:5432/postgres' --dry-run
```

This applies your schema, Row Level Security policies, and any future migration files in `supabase/migrations/`.

In Coolify, the included `migrate` service will do the same automatically on deploy before the `app` service starts.

Useful migration env vars for the app stack:

- `MIGRATION_DATABASE_URL=postgresql://postgres:<password>@postgres-<uuid>:5432/postgres`
- `MIGRATION_AUTO_APPLY=true`
- `MIGRATION_INCLUDE_SEED=false`
- `MIGRATION_MAX_ATTEMPTS=20`
- `MIGRATION_RETRY_DELAY_SECONDS=5`

If you want to inspect or rerun commands manually, open the terminal for the `migrate` service and run:

```bash
./node_modules/.bin/supabase migration list --db-url "$MIGRATION_DATABASE_URL"
./node_modules/.bin/supabase db push --db-url "$MIGRATION_DATABASE_URL"
```

### 3. Deploy the app stack

Create a Docker Compose application in Coolify:

- Repository: this repo
- Compose file: `ConsultantPlatformApp/docker-compose.coolify.yml`

Required app environment variables:

- `NEXT_PUBLIC_SUPABASE_URL=https://supabase.example.com`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from Coolify Supabase>`
- `SUPABASE_SERVICE_ROLE_KEY=<service_role key from Coolify Supabase>`
- `OPENAI_API_KEY=<your OpenAI key>`
- `ALLOWED_ORIGINS=https://app.example.com`
- `MIGRATION_DATABASE_URL=<postgres connection string reachable from this stack>`

Recommended defaults:

- `APP_PORT=3000`
- `AI_SERVICE_PORT=8000`
- `OPENAI_MODEL=gpt-4o-mini`
- `OPENAI_VISION_MODEL=gpt-4o`
- `OPENAI_AUDIO_MODEL=whisper-1`

### 4. Domain routing

- Assign your public app domain to the `app` service on port `3000`.
- Do not expose `ai` publicly.
- Keep Supabase on its own Coolify-managed domain so browser Supabase requests go through its Kong gateway.

### 5. Validate before first deploy

From this directory:

```bash
docker compose -f docker-compose.coolify.yml config
```

After deployment, verify:

- sign up / sign in works against the Coolify Supabase domain
- consultation reads and writes succeed
- theme and draft generation reaches the internal AI service

### Optional: custom Kong overrides

If you ever choose to override Coolify's Supabase service with your own custom self-hosted stack, this repo now includes a production-style Kong reference at `supabase/kong.yml` plus `supabase/kong-entrypoint.sh`.

That config mirrors the current upstream Supabase pattern:

- env substitution is handled before Kong starts
- `apikey` is translated into `Authorization` for Auth and PostgREST
- open auth endpoints (`/auth/v1/verify`, `/callback`, `/authorize`, JWKS) stay publicly reachable

For the recommended Coolify one-click Supabase deployment, you do not need to mount that Kong config from this app repo.

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

# ConsultantPlatform

Psychosocial consultation evidence platform. Turn post-interview admin into a repeatable evidence workflow: transcript capture, theme clarification, person linking, and evidence email generation.

## Prerequisites

- Node.js 20+
- Python 3.12+
- Docker & Docker Compose
- Supabase CLI (`brew install supabase/tap/supabase`)

## Local Development Setup

### 1. Environment variables

```bash
cp .env.example .env
# Fill in your Supabase and OpenAI keys
```

### 2. Start Supabase locally

```bash
supabase start
# This will output your local SUPABASE_URL and ANON_KEY — copy them to .env
```

### 3. Run database migrations

```bash
supabase db reset
# Or: supabase migration up
```

### 4. Start the Next.js app

```bash
npm install
npm run dev
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

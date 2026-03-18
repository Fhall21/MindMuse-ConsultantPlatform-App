# ConsultantPlatform — Claude Code Guide

## Product Context

A psychosocial consultation evidence platform for consultants who need to prove consultations happened, what was discussed, and what follow-up exists. The core workflow is: transcript intake → theme clarification → person linking → evidence email generation → audit trail.

**v1 MVP focus:** Post-interview email drafting, transcript paste, theme clarification prompts, person linking, basic audit trail.

**Non-goals for v1:** Scheduling, live recording, multi-jurisdiction compliance, mobile-first, generic CRM.

**Design principle:** If a feature does not strengthen the evidence trail or reduce post-interview effort, it does not ship first.

---

## Working Agreement

### Before Starting Work

- **Ask clarifying questions first.** Do not start implementation until intent, scope, and acceptance criteria are clear.
- **Always produce a plan** before writing code. For non-trivial tasks, use `/plan-eng-review` or `/plan-ceo-review` to pressure-test it.
- **Save context** before and after major work sessions using the context-mode MCP server so work can be resumed cleanly across sessions.
- **Confirm success and failure states** before handing off any completed task. Every piece of work should have explicit: what done looks like, what partial completion looks like, and what failure looks like.

### During Work

- Ask questions when something is ambiguous — do not assume and proceed.
- Surface blockers early rather than working around them silently.
- Prefer small, reviewable increments. Do not bundle unrelated changes.
- Do not add features, refactor, or "improve" beyond what was asked.
- **Commit as you work.** After each meaningful unit of work, commit only the specific files changed with a relevant commit message. Do not batch unrelated files into a single commit.

### Handing Off

When completing a task, always state:

**✓ Success state:** What was completed and how to verify it.
**⚠ Partial / degraded state:** What was not completed or left open, and why.
**✗ Failure state:** What would indicate this work broke something, and where to look.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14+ (App Router), React, Tailwind CSS, Shadcn UI (preset `aKpFZLe`) |
| Data fetching | TanStack Query, TanStack Table |
| Forms | React Hook Form + Zod |
| Rich text | Tiptap / ProseMirror / Slate (TBD) |
| File uploads | Uppy |
| Backend (v1) | Supabase + PostgreSQL |
| AI service | FastAPI (Python sidecar) + OpenAI GPT-4o |
| Auth | Supabase Auth (PKCE flow) |
| Containerisation | Docker Compose |

---

## Project Structure

```
app/
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
  consultations/        Feature components
  people/               Feature components
lib/
  supabase/             Browser + server clients, middleware
  openai/               AI service client
  validations/          Zod schemas
hooks/                  Custom hooks (TanStack Query wrappers)
types/                  Shared TypeScript types
services/ai/            FastAPI AI sidecar
supabase/migrations/    PostgreSQL migrations
```

---

## Key Constraints

- **Data sensitivity:** Consultation data is compliance-sensitive. Never suggest patterns that weaken access control, skip audit logging, or undermine data locality options.
- **Supabase portability:** v1 uses Supabase but the schema must remain portable to plain PostgreSQL. No Supabase-specific extensions or lock-in.
- **Design system:** Use Shadcn UI preset `aKpFZLe` only. Do not introduce alternative component libraries.
- **License discipline:** All dependencies must be MIT or clearly compatible.

---

## Database

All tables have Row Level Security (RLS) enabled. Users can only read/write their own data. Child records cascade-delete with parents.

Tables: `consultations`, `themes`, `people`, `consultation_people`, `evidence_emails`, `audit_log`.

Migrations are in `supabase/migrations/`.

---

## AI Service

The FastAPI sidecar at `services/ai/` handles LLM calls. Two endpoints:
- `POST /themes/extract` — extract themes from transcript
- `POST /draft/email` — generate evidence email draft

The Next.js app calls the AI service via `AI_SERVICE_URL` env var.

---

## Running Locally

```bash
cp .env.example .env           # Fill in keys
supabase start                 # Local Supabase
supabase db reset              # Apply migrations
bun install && bun run dev     # Next.js on :3000
cd services/ai && uvicorn main:app --reload  # FastAPI on :8000
```

Or: `docker compose up` for all services.

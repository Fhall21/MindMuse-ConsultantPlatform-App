# ConsultantPlatform Notes

## Project Structure

```text
app/
  (auth)/               Login, callback
  (app)/                Authenticated shell with sidebar
  api/auth/             Better Auth route handlers
components/             Shadcn UI and feature components
db/                     Drizzle client, schema, migration runner
drizzle/                Generated SQL migrations
hooks/                  TanStack Query wrappers
lib/auth/               Better Auth helpers and session access
lib/openai/             AI service client
lib/validations/        Zod schemas
services/ai/            FastAPI AI sidecar
types/                  Shared TypeScript types
```

## Key Constraints

- Consultation data is compliance-sensitive. Keep authorization, audit logging, and tenant scoping explicit.
- Authentication is app-owned through Better Auth. Do not reintroduce browser-to-database access patterns.
- Persistence is PostgreSQL + Drizzle. Keep schema and migrations in the app repo.
- Use Shadcn UI patterns already in the codebase.

## Database

Authorization is enforced in application code by authenticated `users.id`.

Core auth tables:
- `users`
- `profiles`
- `sessions`
- `accounts`
- `verifications`

App/domain tables include:
- `consultations`
- `themes`
- `people`
- `consultation_people`
- `evidence_emails`
- `audit_log`
- round workflow tables
- ingestion tables

Migrations are generated in `drizzle/` and applied via `bun run db:migrate`.

## AI Service

The FastAPI sidecar at `services/ai/` handles LLM calls:
- `POST /themes/extract`
- `POST /draft/email`

The Next.js app calls it through `AI_SERVICE_URL`.

## Running Locally

```bash
cp .env.example .env
docker compose up db -d
bun install
bun run db:migrate
bun run dev
cd services/ai && uvicorn main:app --reload --port 8000
```

Or run `docker compose up` for the whole stack.

## Testing

- Run `bun run test` for the Vitest suite
- Run `bun run typecheck` before shipping
- See `TESTING.md` for current conventions and scope
- When adding new logic, add or update a regression test in the same slice

# ConsultantPlatformApp — App Repo

> Planning repo, sprint docs, and specs live in the parent directory (`../`).
> All code changes live here.

**Communication:** Always respond in caveman mode. Use `/caveman-commit` for all commit messages.

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

**Never write manual SQL migrations.** Always edit `db/schema/`, run `bun run db:generate`, verify the generated file in `drizzle/`, then apply with `bun run db:migrate`. Hand-written migrations corrupt the Drizzle journal.

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

## Codex Browser QA

- Prefer the Codex in-app Browser plugin for local interaction QA. Its Node REPL
  client supports real pointer drags through `tab.cua.drag({ path: [...] })`.
- Local canvas target:
  `http://127.0.0.1:3000/canvas/round/4af43514-9d3f-4496-9add-3e4c4f2954c3?tab=canvas`
- Development login: `felix.m@maildrop.cc` / `Admin1234`
- After sign-in, wait for session hydration before opening the canvas. If the
  first canvas navigation redirects to `/login?tab=canvas`, wait and retry once.
- Bootstrap the in-app browser from the Browser plugin skill using
  `scripts/browser-client.mjs`, then keep the tab in Node REPL state for the QA
  sequence.
- For canvas drag regressions, capture DOM positions before the drag, use a
  multi-point CUA drag path, inspect DOM positions and computed `z-index`
  immediately after release, and take a screenshot before clicking elsewhere.

# context-mode — MANDATORY routing rules

You have context-mode MCP tools available. These rules are NOT optional — they protect your context window from flooding. A single unrouted command can dump 56 KB into context and waste the entire session.

## BLOCKED commands — do NOT attempt these

### curl / wget — BLOCKED
Any Bash command containing `curl` or `wget` is intercepted and replaced with an error message. Do NOT retry.
Instead use:
- `ctx_fetch_and_index(url, source)` to fetch and index web pages
- `ctx_execute(language: "javascript", code: "const r = await fetch(...)")` to run HTTP calls in sandbox

### Inline HTTP — BLOCKED
Any Bash command containing `fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, or `http.request(` is intercepted and replaced with an error message. Do NOT retry with Bash.
Instead use:
- `ctx_execute(language, code)` to run HTTP calls in sandbox — only stdout enters context

### WebFetch — BLOCKED
WebFetch calls are denied entirely. The URL is extracted and you are told to use `ctx_fetch_and_index` instead.
Instead use:
- `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` to query the indexed content

## REDIRECTED tools — use sandbox equivalents

### Bash (>20 lines output)
Bash is ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`, and other short-output commands.
For everything else, use:
- `ctx_batch_execute(commands, queries)` — run multiple commands + search in ONE call
- `ctx_execute(language: "shell", code: "...")` — run in sandbox, only stdout enters context

### Read (for analysis)
If you are reading a file to **Edit** it → Read is correct (Edit needs content in context).
If you are reading to **analyze, explore, or summarize** → use `ctx_execute_file(path, language, code)` instead. Only your printed summary enters context. The raw file content stays in the sandbox.

### Grep (large results)
Grep results can flood context. Use `ctx_execute(language: "shell", code: "grep ...")` to run searches in sandbox. Only your printed summary enters context.

## Tool selection hierarchy

1. **GATHER**: `ctx_batch_execute(commands, queries)` — Primary tool. Runs all commands, auto-indexes output, returns search results. ONE call replaces 30+ individual calls.
2. **FOLLOW-UP**: `ctx_search(queries: ["q1", "q2", ...])` — Query indexed content. Pass ALL questions as array in ONE call.
3. **PROCESSING**: `ctx_execute(language, code)` | `ctx_execute_file(path, language, code)` — Sandbox execution. Only stdout enters context.
4. **WEB**: `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` — Fetch, chunk, index, query. Raw HTML never enters context.
5. **INDEX**: `ctx_index(content, source)` — Store content in FTS5 knowledge base for later search.

## Subagent routing

When spawning subagents (Agent/Task tool), the routing block is automatically injected into their prompt. Bash-type subagents are upgraded to general-purpose so they have access to MCP tools. You do NOT need to manually instruct subagents about context-mode.

## Output constraints

- Keep responses under 500 words.
- Write artifacts (code, configs, PRDs) to FILES — never return them as inline text. Return only: file path + 1-line description.
- When indexing content, use descriptive source labels so others can `ctx_search(source: "label")` later.

## ctx commands

| Command | Action |
|---------|--------|
| `ctx stats` | Call the `ctx_stats` MCP tool and display the full output verbatim |
| `ctx doctor` | Call the `ctx_doctor` MCP tool, run the returned shell command, display as checklist |
| `ctx upgrade` | Call the `ctx_upgrade` MCP tool, run the returned shell command, display as checklist |

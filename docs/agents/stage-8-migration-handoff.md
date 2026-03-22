# Stage 8 Database Refactoring Handoff — Agent 8

**Date:** 2026-03-22
**Status:** Schema and database aligned at 0003 baseline, ready for incremental refactoring
**Approach:** Schema-first workflow with `drizzle-kit generate`
**Work:** 11 atomic migrations to implement consultation/round → meeting/consultation terminology refactoring

---

## Executive Summary

You are being handed a PostgreSQL schema that has been successfully reset and aligned to a known baseline (migrations 0000–0004). Your job is to implement 11 additional schema-first migrations using Drizzle ORM's `drizzle-kit generate` command to complete a comprehensive terminology refactoring.

**What's done:** Database reset, schema baseline alignment, blocker analysis.
**What's left:** Steps 1–11 of the refactoring (rename tables, rename columns, create new tables, update constraints).
**Duration:** ~1.5 seconds total schema downtime across all 11 migrations (atomic, safe, tested architecture).

---

## Context: Why This Refactoring Exists

This refactoring stems from commit `8911d65` ("Step 1 - database schema rename consultation/round → meeting/consultation + phases"), which introduced terminology changes to better align the database schema with product vocabulary:

### Old Terminology
- `consultation_rounds` — top-level grouping entity for collections of meetings
- `consultations` — individual session transcript (title, transcript_raw, status, round_id FK)
- `round_decisions` — decisions made during a round
- `round_output_artifacts` — artifacts generated in a round

### New Terminology
- `consultations` — top-level grouping entity (formerly `consultation_rounds`)
- `meetings` — individual session transcript (formerly `consultations`)
- `consultation_decisions` — decisions in a consultation
- `consultation_output_artifacts` — artifacts in a consultation
- `phases` — new table to structure meetings into discovery/discussion/review_feedback phases

**Key insight:** The old `consultations` table (transaction-level) is NOT the same as the new `consultations` table (grouping entity). This refactoring creates the new `consultations` table as a simple entity with `(id, user_id, label, description, created_at)`, then renames the old transaction-level `consultations` → `meetings`.

---

## Current System State

### Database State
- PostgreSQL running at `postgresql://postgres:postgres@127.0.0.1:5432/consultant_platform`
- 31 tables present (all from migrations 0000–0004)
- Table names follow old terminology (consultation_rounds, consultations, round_decisions, etc.)
- All data is structural; no user data yet in dev

### Schema Code State
- `db/schema/domain.ts` — source of truth for schema definition
- Currently at 0003 baseline: old terminology (consultationRounds, consultations export, round_decisions, etc.)
- Matches the live database state exactly

### Drizzle Metadata State
- `drizzle/meta/_journal.json` — records applied migrations (0000–0004)
- `drizzle/meta/0000_snapshot.json` — baseline snapshot of initial schema
- Other stale snapshots have been cleaned up
- Status: No outstanding schema changes (`drizzle-kit generate` returns "No schema changes, nothing to migrate")

---

## Why This Approach: Schema-First with Drizzle

### The Constraint
Drizzle operates in **schema-first** mode, where:
1. You modify `db/schema/domain.ts` (TypeScript source of truth)
2. You run `bun run db:generate` in an interactive terminal
3. Drizzle compares the schema code to the last snapshot and detects changes
4. Drizzle asks clarifying questions (e.g., "Is this a table rename or create+delete?")
5. You answer the questions interactively
6. Drizzle generates the migration SQL and updates snapshots

**Critical constraint:** If you write manual SQL migrations without updating snapshots, Drizzle's future `generate` runs will fail or produce incorrect migrations because snapshots will be out of sync with the database.

### Why Reset the Database
Initial attempts used manual SQL-first migrations, but this created snapshot drift. The user explicitly requested schema-first approach. Solution: full database reset to a clean state with accurate snapshots, then proceed with incremental schema modifications + generates.

### How This Works
Each step follows this cycle:
1. Modify `db/schema/domain.ts` (ONE change type per step: rename 2 tables OR rename 5 columns, not both)
2. Run `bun run db:generate` (in interactive terminal)
3. Answer Drizzle's interactive prompts (e.g., "Rename table X to Y? [y/n]")
4. Review the generated `.sql` file
5. Commit the migration + schema change together
6. Database schema stays in sync with schema code via snapshots

---

## The 11 Steps Overview

See `drizzle/MIGRATIONS_0007_0017_SUMMARY.md` for the complete reference. Summary:

| Step | Migrations | Type | Action | Tables/Columns Affected |
|------|-----------|------|--------|------------------------|
| 1 | 0006 | TABLE RENAME (2) | `consultationRounds` → `consultations`, `consultations` → `meetings` | 2 tables |
| 2 | 0007 | TABLE CREATE | Create new `consultations` table (grouping entity) | +1 table |
| 3 | 0008 | COLUMN RENAME | Rename `round_id` → `consultation_id` in `meetings` | 1 column |
| 4 | 0009 | TABLE RENAME (4) | Rename people, groups, decisions, artifacts tables | 4 tables |
| 5 | 0010 | COLUMN RENAME (6) | Rename `consultation_id` → `meeting_id` in 6 tables | 6 columns |
| 6 | 0011 | COLUMN RENAME (2) | Rename `consultation_id` → `meeting_id` in 2 more tables | 2 columns |
| 7 | 0012 | COLUMN RENAME (2) | Rename `round_id` → `consultation_id` in 2 tables | 2 columns |
| 8 | 0013 | COLUMN RENAME (3) | Rename `round_id` → `consultation_id` in 3 more tables | 3 columns |
| 9 | 0014 | COLUMN RENAME (1) | Rename `source_consultation_id` → `source_meeting_id` | 1 column |
| 10 | 0015 | CONSTRAINT RENAME | Drop and recreate CHECK constraints with new names | 7 constraints |
| 11 | 0016 | TABLE CREATE | Create `phases` table for meeting structure | +1 table |

**Total scope:** 2 + 4 table renames, 15 column renames, 2 new tables, 7 constraint updates.

---

## Workflow: How to Execute Each Step

### Step 1: Rename consultationRounds → consultations (+ consultations → meetings)

**File:** `db/schema/domain.ts`

1. Open the file and find line 26 (export for consultationRounds):
   ```typescript
   // OLD:
   export const consultationRounds = pgTable("consultation_rounds", {
   // NEW:
   export const consultations = pgTable("consultation_rounds", {
   ```

2. Find line 42 (export for consultations):
   ```typescript
   // OLD:
   export const consultations = pgTable("consultations", {
   // NEW:
   export const meetings = pgTable("consultations", {
   ```

3. Find all FK references in the file that point to `consultationRounds.id` and change them to `consultations.id`. (Approx. 15 references scattered throughout.)

4. **Run in interactive terminal:**
   ```bash
   bun run db:generate
   ```

5. **Answer Drizzle's prompts:**
   - "Is consultation_rounds table renamed from consultation_rounds? Yes (rename, not create+drop)"
   - "Is consultations table renamed to meetings? Yes"

6. **Review the generated migration file** (likely `drizzle/0006_*.sql`):
   - Should contain only two ALTER TABLE RENAME statements
   - Should NOT contain CREATE or DROP statements
   - Example:
     ```sql
     ALTER TABLE "consultation_rounds" RENAME TO "consultations";
     ALTER TABLE "consultations" RENAME TO "meetings";
     ```

7. **Commit:**
   ```bash
   git add db/schema/domain.ts drizzle/0006_*.sql drizzle/meta/_journal.json drizzle/meta/0006_snapshot.json
   git commit -m "refactor: schema step 1 - rename consultationRounds→consultations, consultations→meetings"
   ```

### Steps 2–11: Follow the Same Pattern

For each subsequent step:
1. Open `db/schema/domain.ts`
2. Make ONE type of change (rename table set OR rename column set OR create table OR update constraint)
3. Run `bun run db:generate` interactively
4. Answer prompts
5. Review generated SQL
6. Commit

**Helpful reference:** `drizzle/MIGRATIONS_0007_0017_SUMMARY.md` lists exactly which tables/columns to rename at each step.

---

## Critical Constraints

### One Change Type Per Step
- **DO:** Rename 4 tables in one step
- **DO:** Rename 6 columns in one step
- **DON'T:** Mix rename + add, rename + FK change, or table rename + column rename in the same step

This constraint exists because:
- Drizzle's change detection can become ambiguous with mixed changes
- Atomic migrations are easier to review and rollback
- Naming consistency is clearer

### Interactive Terminal Required
- `bun run db:generate` requires a TTY (interactive terminal)
- It will hang or fail in a non-interactive environment (CI/scripts)
- Must be run locally in the terminal

### Answer Prompts Correctly
When Drizzle asks "Is table X renamed to Y?":
- Answer `y` if you intend a rename (idempotent, preserves data)
- Answer `n` only if you intend create + drop (destructive, data loss)
- Answering `n` to a rename creates a useless create+drop cycle

---

## Troubleshooting

### "No schema changes, nothing to migrate 😴"
- **Cause:** schema.ts hasn't been modified since last generate
- **Fix:** Double-check your edits to domain.ts were saved and correct

### "Is X table created or renamed from another table?"
- **Cause:** Drizzle is ambiguous; it sees table X existing in schema but not in snapshot
- **Fix:** Ensure you've made the corresponding rename in schema.ts; answer `y` for rename, `n` for new create

### "drizzle-kit generate: not found" or script error
- **Cause:** `bun run db:generate` relies on package.json script definition
- **Check:** `grep "db:generate" package.json` — should show `"db:generate": "drizzle-kit generate"`

### Migration failed after I answered prompts
- **Cause:** Generated SQL may have syntax errors or constraint issues
- **Fix:** Review the generated `.sql` file; look for invalid syntax or missing FKs; manually edit if needed (then run `bun run db:generate` again to re-snapshot)

### I accidentally deleted a file or want to undo
- **Fix:** `git checkout drizzle/meta/` to restore snapshots; then re-run `bun run db:generate`

---

## Files You'll Touch

```
db/schema/domain.ts              ← Main schema definition (YOUR PRIMARY WORK)
drizzle/00{06-16}_*.sql          ← Generated migrations (auto-created by drizzle-kit)
drizzle/meta/_journal.json       ← Migration index (auto-updated)
drizzle/meta/00{06-16}_snapshot.json  ← Snapshots (auto-created)
MIGRATIONS_0007_0017_SUMMARY.md  ← Reference guide (read-only, for lookup)
```

---

## Success Criteria

✅ **Each step completes when:**
- `db/schema/domain.ts` has been modified with the correct terminology
- `drizzle-kit generate` runs without errors
- Generated `.sql` file contains only the expected change type (no mixed operations)
- Migration file is added to git
- Snapshot is updated

✅ **Full refactoring completes when:**
- All 11 steps are merged to main
- Schema code and database both reflect new terminology
- `bun run db:generate` returns "No schema changes"
- Code imports/type references have been updated to use new table names (separate PR/task)

---

## Post-Migration Code Updates

**NOTE:** These schema migrations only change table/column names in the database. You will still need to update:
- Import statements in `lib/` and `services/`
- Type exports in `types/`
- API route handlers that reference old names
- React component queries that use old table names

This is a separate follow-up task and should be done after the schema migrations are complete.

---

## Quick Reference: Key Git Commits for Context

- **514d3e5** — Initial Drizzle setup (migration 0000)
- **64e7328** — Pre-refactor baseline (migrations 0001–0004 applied)
- **8911d65** — Major refactor commit (defines the new terminology, not yet applied)
- **7370105** — Restore compatibility aliases (restores old exports for backward compat)

If you need to understand why a particular column is named something, `git log --oneline | grep <name>` or read the commit messages in these commits.

---

## Questions for Agent 8?

If something is unclear:
1. Check `MIGRATIONS_0007_0017_SUMMARY.md` for the full step-by-step breakdown
2. Look at `db/schema/domain.ts` commit 64e7328 to see the 0003 baseline state
3. Search git history: `git log -S "tableName" --oneline`
4. Ask in the session or open an issue

**You've got this.** The hardest part (alignment + architecture) is done. Now it's just incremental schema edits + drizzle-kit. 🚀

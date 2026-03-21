# Migration Best Practices

Lessons learned from database migration work on the ConsultantPlatform project.

## Trigger Functions

**Rule:** Define trigger functions **before** any table that references them.

**Why:** Tables cannot use `EXECUTE FUNCTION` in their trigger definitions if the function doesn't exist. This causes migration failures with "function does not exist" errors.

**How to apply:**
- Create trigger functions in an early migration (e.g., `0000a_create_trigger_functions.sql`)
- OR use `CREATE OR REPLACE FUNCTION` as a safeguard at the beginning of any migration that uses the function
- This prevents the migration system from picking up the new file later

## Table and Column Renames

**Rule:** When renaming a table, also rename all its columns to match the new semantic meaning.

**Why:** The table rename in migration 0001 changed `theme_decision_logs` → `insight_decision_logs`, but columns remained `theme_id` and `theme_label`. This caused "column does not exist" errors months later when application code expected `insight_id` and `insight_label`.

**How to apply:**
- Document all column renames alongside table renames
- Use explicit `ALTER TABLE ... RENAME COLUMN` statements (not implicit)
- Test the new column names immediately with a followup migration if needed
- Add a migration comment explaining the semantic change

## Schema References

**Rule:** Explicitly reference the schema when creating foreign keys to tables in non-default schemas.

**Why:** PostgreSQL defaults to the `public` schema, but Better Auth stores users in `public.users`. Ambiguous references like `REFERENCES users(id)` can resolve incorrectly in some contexts.

**How to apply:**
- Use `REFERENCES public.users(id)` not just `REFERENCES users(id)`
- This makes the intent clear and prevents schema resolution errors in deployment

## Migration File Naming

**Rule:** Use lexicographic ordering for migration files (0000, 0000a, 0001, 0002, etc.).

**Why:** Drizzle's migration system runs migrations in sorted order. Files like `0001a_function.sql` will sort AFTER `0001_rename.sql`, not before.

**How to apply:**
- For urgent fixes between existing migrations, use 0001a, 0001b, etc.
- Better: use 0000a or 0000b for pre-work that earlier migrations depend on
- Verify the sort order: `ls -1 drizzle/*.sql | sort`

## New Migrations and System Pickup

**Rule:** Assume new migration files added late in the project may not be picked up by the migration system if it only tracks already-applied migrations.

**Why:** Drizzle tracks applied migrations in the database. A new `0000a_functions.sql` added after other migrations have run may be skipped because the system doesn't know about it.

**How to apply:**
- Include safeguard logic in subsequent migrations that depend on early setup
- Use `CREATE OR REPLACE FUNCTION` and `CREATE TABLE IF NOT EXISTS` for defensive programming
- Test locally before deploying to Coolify

## Docker and Build Dependencies

**Rule:** Include build tools in the Dockerfile for packages that compile from source.

**Why:** Packages like `hdbscan` require `gcc` to build. Alpine/slim images don't include them, causing Docker builds to fail in Coolify.

**How to apply:**
- Add `build-essential gcc g++` in the RUN statement before `pip install`
- Clean up apt cache: `rm -rf /var/lib/apt/lists/*` to keep image lean
- Example:
  ```dockerfile
  RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential gcc g++ \
      && rm -rf /var/lib/apt/lists/*
  ```

## Testing Migrations

**Rule:** Always test migrations locally before deploying to production/Coolify.

**Why:** Migration errors in production are harder to debug and may require manual SQL fixes.

**How to apply:**
- Run `bun run db:migrate` locally with a fresh database
- Verify all tables and columns exist: `\dt` and `\d table_name` in psql
- Check function definitions: `\df function_name`
- Only then push to Coolify

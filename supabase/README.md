This directory is a legacy snapshot from the previous Supabase-based stack.

The current application runtime no longer uses these files for local development
or deployment. The active database and auth paths now live under:

- `db/`
- `drizzle/`
- `lib/auth/`

Keep this directory only as historical reference while the PostgreSQL + Drizzle
cutover settles. Do not point Docker, Coolify, or new migration workflows at
this folder.

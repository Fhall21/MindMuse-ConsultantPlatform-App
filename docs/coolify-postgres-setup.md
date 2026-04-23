# Coolify PostgreSQL Setup

Use one Docker Compose app. Two DB parts:

- `db`: PostgreSQL + persistent volume.
- `migrate`: manual shell for schema work.

## Connection

Point app at `db` with env vars: `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`.

## Migrations

Keep migrations in checked-in `drizzle/`. Create migration files and journal with Drizzle CLI, not by hand or via agents.

Run:

```bash
bun run db:migrate
```

In Coolify, open `migrate` terminal. Run:

```bash
bun run db/migrate.ts
```

- Make `migrate` manual, not health-checked.
- Test local first.
- Put extensions like `vector` in migration so fresh DB get them too.
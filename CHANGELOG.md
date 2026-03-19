# Changelog

All notable changes to this project will be documented in this file.

This project uses a four-part release version in `VERSION` and a three-part app
package version in `package.json`.

## [0.1.1.0] - 2026-03-19

### Added
- Drizzle-backed PostgreSQL schema, migration runner, and typed data access layer.
- Better Auth integration with app-owned user profile data and Next.js auth routes.
- Client data routes for consultations, rounds, people, themes, evidence emails, and audit views.
- Vitest test suite, GitHub Actions test workflow, and `TESTING.md`.

### Changed
- Replaced Supabase runtime dependencies with app-owned PostgreSQL + Drizzle + Better Auth.
- Updated local Docker Compose and Coolify deployment configuration to run PostgreSQL, migrations, app, and AI services together.
- Migrated consultation, report, ingestion, OCR, audit, and round-workflow persistence onto Drizzle-backed actions and readers.
- Swapped `middleware.ts` for `proxy.ts` to match the current Next.js auth entrypoint.
- Refreshed project documentation to reflect the new database, auth, and deployment model.

### Fixed
- Restored round theme merge and split actions so changes persist server-side instead of only in local UI state.
- Fixed round theme selection bookkeeping to use theme IDs consistently across selection, split, and group member counts.
- Removed stale Supabase migration entrypoint files that could point deployments at the wrong workflow.

### Removed
- Supabase browser/server client helpers and the old Supabase CLI migration runner from the active runtime path.

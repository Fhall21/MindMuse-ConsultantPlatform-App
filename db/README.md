# Database Contract

Stage 5 moves the app from Supabase-shaped persistence to app-owned PostgreSQL + Drizzle.

## Ownership Contract

- `users.id` is the canonical auth/user identifier for the product.
- Domain tables that previously referenced `auth.users(id)` now reference `users.id`.
- `profiles.user_id` is a 1:1 extension table for app-owned profile data such as:
  - `display_name`
  - `full_name`

## Better Auth Integration Contract

Agent 2 should configure Better Auth to:

- use UUID ids
- map its user model to the `users` table
- keep session/account/verification tables in PostgreSQL alongside the domain tables
- avoid storing `display_name` or `full_name` as Better Auth additional fields

## Profile Contract

App-owned profile data lives in `profiles`, not in Better Auth user metadata or additional fields.

- `profiles.user_id` is a strict 1:1 FK to `users.id`
- `profiles.display_name` is the preferred short label shown in the UI
- `profiles.full_name` is the longer legal/full name
- auth/session code should join or load `profiles` when those fields are needed

This keeps the domain model stable while auth implementation is swapped out.

## Authorization Contract

Authorization is enforced in application code, not via Supabase-style RLS policies.

All read and write paths should scope by the current authenticated `users.id`.

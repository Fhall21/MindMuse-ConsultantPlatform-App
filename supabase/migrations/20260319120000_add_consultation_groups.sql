-- Stage: consultation groups within rounds
-- A round can have many groups; each consultation belongs to at most one group per round.
-- Mirrors the round_theme_groups pattern. PostgreSQL-portable: no Supabase-specific extensions.

-- ─── consultation_groups ──────────────────────────────────────────────────────

create table if not exists consultation_groups (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid not null references consultation_rounds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  position integer not null default 0 check (position >= 0),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table consultation_groups enable row level security;

create policy "Users can view own consultation_groups"
  on consultation_groups for select
  using (auth.uid() = user_id);

create policy "Users can insert own consultation_groups"
  on consultation_groups for insert
  with check (auth.uid() = user_id);

create policy "Users can update own consultation_groups"
  on consultation_groups for update
  using (auth.uid() = user_id);

create policy "Users can delete own consultation_groups"
  on consultation_groups for delete
  using (auth.uid() = user_id);

create trigger set_consultation_groups_updated_at
  before update on consultation_groups
  for each row
  execute function update_updated_at_column();

-- ─── consultation_group_members ───────────────────────────────────────────────
-- Each consultation can belong to at most one group per round (unique constraint).

create table if not exists consultation_group_members (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references consultation_groups(id) on delete cascade,
  round_id uuid not null references consultation_rounds(id) on delete cascade,
  consultation_id uuid not null references consultations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- A consultation can only be in one group per round
  unique (round_id, consultation_id)
);

alter table consultation_group_members enable row level security;

create policy "Users can view own consultation_group_members"
  on consultation_group_members for select
  using (auth.uid() = user_id);

create policy "Users can insert own consultation_group_members"
  on consultation_group_members for insert
  with check (auth.uid() = user_id);

create policy "Users can update own consultation_group_members"
  on consultation_group_members for update
  using (auth.uid() = user_id);

create policy "Users can delete own consultation_group_members"
  on consultation_group_members for delete
  using (auth.uid() = user_id);

-- ─── group_id FK on round_output_artifacts ────────────────────────────────────
-- Optional: when an artifact is generated for a specific group rather than the whole round.

alter table round_output_artifacts
  add column if not exists group_id uuid references consultation_groups(id) on delete set null;

-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index idx_consultation_groups_round_id on consultation_groups(round_id);
create index idx_consultation_groups_user_round on consultation_groups(user_id, round_id);
create index idx_consultation_group_members_group_id on consultation_group_members(group_id);
create index idx_consultation_group_members_round_id on consultation_group_members(round_id);
create index idx_consultation_group_members_consultation_id on consultation_group_members(consultation_id);

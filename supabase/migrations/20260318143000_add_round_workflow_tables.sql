-- Stage 4: round workflow groups, decisions, and output artifacts
-- PostgreSQL-portable: standard SQL with standard PostgreSQL trigger support

create table if not exists round_theme_groups (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid not null references consultation_rounds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'accepted', 'discarded', 'management_rejected')),
  origin text not null default 'manual'
    check (origin in ('manual', 'ai_refined')),
  ai_draft_label text,
  ai_draft_description text,
  ai_draft_explanation text,
  ai_draft_created_at timestamptz,
  ai_draft_created_by uuid references auth.users(id) on delete set null,
  last_structural_change_at timestamptz not null default now(),
  last_structural_change_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table round_theme_groups enable row level security;

create policy "Users can view own round_theme_groups"
  on round_theme_groups for select
  using (auth.uid() = user_id);

create policy "Users can insert own round_theme_groups"
  on round_theme_groups for insert
  with check (auth.uid() = user_id);

create policy "Users can update own round_theme_groups"
  on round_theme_groups for update
  using (auth.uid() = user_id);

create policy "Users can delete own round_theme_groups"
  on round_theme_groups for delete
  using (auth.uid() = user_id);

create trigger set_round_theme_groups_updated_at
  before update on round_theme_groups
  for each row
  execute function update_updated_at_column();

create table if not exists round_theme_group_members (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references round_theme_groups(id) on delete cascade,
  round_id uuid not null references consultation_rounds(id) on delete cascade,
  theme_id uuid not null references themes(id) on delete cascade,
  source_consultation_id uuid not null references consultations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, theme_id)
);

alter table round_theme_group_members enable row level security;

create policy "Users can view own round_theme_group_members"
  on round_theme_group_members for select
  using (auth.uid() = user_id);

create policy "Users can insert own round_theme_group_members"
  on round_theme_group_members for insert
  with check (auth.uid() = user_id);

create policy "Users can update own round_theme_group_members"
  on round_theme_group_members for update
  using (auth.uid() = user_id);

create policy "Users can delete own round_theme_group_members"
  on round_theme_group_members for delete
  using (auth.uid() = user_id);

create table if not exists round_decisions (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid not null references consultation_rounds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null
    check (target_type in ('source_theme', 'theme_group', 'round_output')),
  target_id uuid not null,
  decision_type text not null
    check (decision_type in ('accepted', 'discarded', 'management_rejected')),
  rationale text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint round_decisions_management_rejected_requires_rationale
    check (
      decision_type <> 'management_rejected'
      or (rationale is not null and btrim(rationale) <> '')
    )
);

alter table round_decisions enable row level security;

create policy "Users can view own round_decisions"
  on round_decisions for select
  using (auth.uid() = user_id);

create policy "Users can insert own round_decisions"
  on round_decisions for insert
  with check (auth.uid() = user_id);

create table if not exists round_output_artifacts (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid not null references consultation_rounds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  artifact_type text not null
    check (artifact_type in ('summary', 'report', 'email')),
  status text not null default 'generated'
    check (status in ('generated')),
  title text,
  content text not null,
  input_snapshot jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete cascade
);

alter table round_output_artifacts enable row level security;

create policy "Users can view own round_output_artifacts"
  on round_output_artifacts for select
  using (auth.uid() = user_id);

create policy "Users can insert own round_output_artifacts"
  on round_output_artifacts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own round_output_artifacts"
  on round_output_artifacts for update
  using (auth.uid() = user_id);

create policy "Users can delete own round_output_artifacts"
  on round_output_artifacts for delete
  using (auth.uid() = user_id);

create trigger set_round_output_artifacts_updated_at
  before update on round_output_artifacts
  for each row
  execute function update_updated_at_column();

create index idx_round_theme_groups_round_id on round_theme_groups(round_id);
create index idx_round_theme_groups_user_round_status on round_theme_groups(user_id, round_id, status);
create index idx_round_theme_group_members_round_id on round_theme_group_members(round_id);
create index idx_round_theme_group_members_theme_id on round_theme_group_members(theme_id);
create index idx_round_decisions_round_target on round_decisions(round_id, target_type, target_id, created_at desc);
create index idx_round_output_artifacts_round_type on round_output_artifacts(round_id, artifact_type, generated_at desc);

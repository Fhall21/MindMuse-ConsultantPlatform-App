-- Theme decision logging and user-added theme support
-- PostgreSQL-portable: standard SQL with no Supabase extensions

-- ============================================================
-- Extend themes table with user-added and weighting metadata
-- ============================================================
alter table themes add column if not exists is_user_added boolean not null default false;
alter table themes add column if not exists weight numeric not null default 1.0;

-- ============================================================
-- theme_decision_logs: Track user decisions for learning signals
-- ============================================================
create table theme_decision_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consultation_id uuid not null references consultations(id) on delete cascade,
  theme_id uuid not null references themes(id) on delete cascade,
  round_id uuid references consultation_rounds(id) on delete set null,
  decision_type text not null check (decision_type in ('accept', 'reject', 'user_added')),
  rationale text,
  created_at timestamptz not null default now()
);

alter table theme_decision_logs enable row level security;

create policy "Users can view own theme_decision_logs"
  on theme_decision_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own theme_decision_logs"
  on theme_decision_logs for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- Indexes for efficient querying
-- ============================================================
create index idx_theme_decision_logs_user_id on theme_decision_logs(user_id);
create index idx_theme_decision_logs_consultation_id on theme_decision_logs(consultation_id);
create index idx_theme_decision_logs_theme_id on theme_decision_logs(theme_id);
create index idx_theme_decision_logs_round_id on theme_decision_logs(round_id);
create index idx_theme_decision_logs_user_consultation_created on theme_decision_logs(user_id, consultation_id, created_at);
create index idx_themes_user_added on themes(is_user_added);

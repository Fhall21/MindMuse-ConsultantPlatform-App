-- Add consultation_rounds table and link to consultations
-- PostgreSQL-portable: standard SQL with no Supabase extensions

-- ============================================================
-- consultation_rounds
-- ============================================================
create table consultation_rounds (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  description text,
  created_at timestamptz not null default now()
);

alter table consultation_rounds enable row level security;

create policy "Users can view own consultation_rounds"
  on consultation_rounds for select
  using (auth.uid() = user_id);

create policy "Users can insert own consultation_rounds"
  on consultation_rounds for insert
  with check (auth.uid() = user_id);

create policy "Users can update own consultation_rounds"
  on consultation_rounds for update
  using (auth.uid() = user_id);

create policy "Users can delete own consultation_rounds"
  on consultation_rounds for delete
  using (auth.uid() = user_id);

-- ============================================================
-- Add round_id to consultations
-- ============================================================
alter table consultations add column round_id uuid references consultation_rounds(id) on delete set null;

-- ============================================================
-- Indexes
-- ============================================================
create index idx_consultation_rounds_user_id on consultation_rounds(user_id);
create index idx_consultations_round_id on consultations(round_id);

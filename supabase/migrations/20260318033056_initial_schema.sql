-- ConsultantPlatform initial schema
-- PostgreSQL-portable: no Supabase-specific extensions or types

-- Enable UUID generation (standard PostgreSQL extension)
create extension if not exists "uuid-ossp";

-- ============================================================
-- consultations
-- ============================================================
create table consultations (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  transcript_raw text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'complete'))
);

alter table consultations enable row level security;

create policy "Users can view own consultations"
  on consultations for select
  using (auth.uid() = user_id);

create policy "Users can insert own consultations"
  on consultations for insert
  with check (auth.uid() = user_id);

create policy "Users can update own consultations"
  on consultations for update
  using (auth.uid() = user_id);

create policy "Users can delete own consultations"
  on consultations for delete
  using (auth.uid() = user_id);

-- ============================================================
-- themes
-- ============================================================
create table themes (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid not null references consultations(id) on delete cascade,
  label text not null,
  accepted boolean not null default false,
  created_at timestamptz not null default now()
);

alter table themes enable row level security;

create policy "Users can view themes for own consultations"
  on themes for select
  using (
    exists (
      select 1 from consultations c
      where c.id = themes.consultation_id
        and c.user_id = auth.uid()
    )
  );

create policy "Users can insert themes for own consultations"
  on themes for insert
  with check (
    exists (
      select 1 from consultations c
      where c.id = themes.consultation_id
        and c.user_id = auth.uid()
    )
  );

create policy "Users can update themes for own consultations"
  on themes for update
  using (
    exists (
      select 1 from consultations c
      where c.id = themes.consultation_id
        and c.user_id = auth.uid()
    )
  );

create policy "Users can delete themes for own consultations"
  on themes for delete
  using (
    exists (
      select 1 from consultations c
      where c.id = themes.consultation_id
        and c.user_id = auth.uid()
    )
  );

-- ============================================================
-- people
-- ============================================================
create table people (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  role text,
  email text,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade
);

alter table people enable row level security;

create policy "Users can view own people"
  on people for select
  using (auth.uid() = user_id);

create policy "Users can insert own people"
  on people for insert
  with check (auth.uid() = user_id);

create policy "Users can update own people"
  on people for update
  using (auth.uid() = user_id);

create policy "Users can delete own people"
  on people for delete
  using (auth.uid() = user_id);

-- ============================================================
-- consultation_people (junction)
-- ============================================================
create table consultation_people (
  consultation_id uuid not null references consultations(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  primary key (consultation_id, person_id)
);

alter table consultation_people enable row level security;

create policy "Users can view own consultation_people"
  on consultation_people for select
  using (
    exists (
      select 1 from consultations c
      where c.id = consultation_people.consultation_id
        and c.user_id = auth.uid()
    )
  );

create policy "Users can insert own consultation_people"
  on consultation_people for insert
  with check (
    exists (
      select 1 from consultations c
      where c.id = consultation_people.consultation_id
        and c.user_id = auth.uid()
    )
  );

create policy "Users can delete own consultation_people"
  on consultation_people for delete
  using (
    exists (
      select 1 from consultations c
      where c.id = consultation_people.consultation_id
        and c.user_id = auth.uid()
    )
  );

-- ============================================================
-- evidence_emails
-- ============================================================
create table evidence_emails (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid not null references consultations(id) on delete cascade,
  body_draft text,
  body_final text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table evidence_emails enable row level security;

create policy "Users can view own evidence_emails"
  on evidence_emails for select
  using (
    exists (
      select 1 from consultations c
      where c.id = evidence_emails.consultation_id
        and c.user_id = auth.uid()
    )
  );

create policy "Users can insert own evidence_emails"
  on evidence_emails for insert
  with check (
    exists (
      select 1 from consultations c
      where c.id = evidence_emails.consultation_id
        and c.user_id = auth.uid()
    )
  );

create policy "Users can update own evidence_emails"
  on evidence_emails for update
  using (
    exists (
      select 1 from consultations c
      where c.id = evidence_emails.consultation_id
        and c.user_id = auth.uid()
    )
  );

create policy "Users can delete own evidence_emails"
  on evidence_emails for delete
  using (
    exists (
      select 1 from consultations c
      where c.id = evidence_emails.consultation_id
        and c.user_id = auth.uid()
    )
  );

-- ============================================================
-- audit_log
-- ============================================================
create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid not null references consultations(id) on delete cascade,
  action text not null,
  payload jsonb,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade
);

alter table audit_log enable row level security;

create policy "Users can view own audit_log entries"
  on audit_log for select
  using (auth.uid() = user_id);

create policy "Users can insert own audit_log entries"
  on audit_log for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- Indexes
-- ============================================================
create index idx_consultations_user_id on consultations(user_id);
create index idx_consultations_status on consultations(status);
create index idx_themes_consultation_id on themes(consultation_id);
create index idx_people_user_id on people(user_id);
create index idx_evidence_emails_consultation_id on evidence_emails(consultation_id);
create index idx_audit_log_consultation_id on audit_log(consultation_id);
create index idx_audit_log_user_id on audit_log(user_id);
create index idx_audit_log_created_at on audit_log(created_at);

-- ============================================================
-- Updated-at trigger (standard PostgreSQL)
-- ============================================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_consultations_updated_at
  before update on consultations
  for each row
  execute function update_updated_at_column();

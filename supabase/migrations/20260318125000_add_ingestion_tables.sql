-- Agent 1: Ingestion Schema — Transcription, OCR, and Artifact Tracking
-- PostgreSQL-portable: standard SQL, no Supabase-specific extensions beyond uuid-ossp

-- ============================================================
-- transcription_jobs
-- Tracks audio file upload, transcription requests, and async processing
-- ============================================================
create table transcription_jobs (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid not null references consultations(id) on delete cascade,
  audio_file_key text not null, -- Supabase Storage path (e.g., "consultations/{id}/audio/{filename}")
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  transcript_text text, -- populated on successful completion
  error_message text, -- populated on failure
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table transcription_jobs enable row level security;

create policy "Users can view transcription jobs for own consultations"
  on transcription_jobs for select
  using (
    exists (
      select 1 from consultations c
      where c.id = transcription_jobs.consultation_id
        and c.user_id = auth.uid()
    )
  );

create policy "Users can insert transcription jobs for own consultations"
  on transcription_jobs for insert
  with check (
    exists (
      select 1 from consultations c
      where c.id = transcription_jobs.consultation_id
        and c.user_id = auth.uid()
    )
  );

create policy "Users can update transcription jobs for own consultations"
  on transcription_jobs for update
  using (
    exists (
      select 1 from consultations c
      where c.id = transcription_jobs.consultation_id
        and c.user_id = auth.uid()
    )
  );

create trigger set_transcription_jobs_updated_at
  before update on transcription_jobs
  for each row
  execute function update_updated_at_column();

-- ============================================================
-- ocr_jobs
-- Tracks image upload for OCR extraction (handwritten notes, artifacts)
-- ============================================================
create table ocr_jobs (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid not null references consultations(id) on delete cascade,
  image_file_key text not null, -- Supabase Storage path
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  extracted_text text, -- populated on successful completion
  confidence_score numeric(3, 2), -- 0.00 to 1.00, optional confidence estimate
  error_message text, -- populated on failure
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ocr_jobs enable row level security;

create policy "Users can view ocr jobs for own consultations"
  on ocr_jobs for select
  using (
    exists (
      select 1 from consultations c
      where c.id = ocr_jobs.consultation_id
        and c.user_id = auth.uid()
    )
  );

create policy "Users can insert ocr jobs for own consultations"
  on ocr_jobs for insert
  with check (
    exists (
      select 1 from consultations c
      where c.id = ocr_jobs.consultation_id
        and c.user_id = auth.uid()
    )
  );

create policy "Users can update ocr jobs for own consultations"
  on ocr_jobs for update
  using (
    exists (
      select 1 from consultations c
      where c.id = ocr_jobs.consultation_id
        and c.user_id = auth.uid()
    )
  );

create trigger set_ocr_jobs_updated_at
  before update on ocr_jobs
  for each row
  execute function update_updated_at_column();

-- ============================================================
-- ingestion_artifacts
-- Canonical ledger of captured materials: transcripts, note scans, clarification review decisions
-- ============================================================
create table ingestion_artifacts (
  id uuid primary key default uuid_generate_v4(),
  consultation_id uuid not null references consultations(id) on delete cascade,
  artifact_type text not null, -- transcript_file | transcript_paste | audio | ocr_image | clarification_response
  source_file_key text not null, -- Supabase Storage path or reference
  metadata jsonb, -- flexible: {filename, originalSize?, uploadedSize?, language?, mimeType, ...}
  accepted boolean default null, -- null=not reviewed, true=accepted, false=rejected
  notes text, -- user clarification or review notes
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ingestion_artifacts enable row level security;

create policy "Users can view ingestion artifacts for own consultations"
  on ingestion_artifacts for select
  using (
    exists (
      select 1 from consultations c
      where c.id = ingestion_artifacts.consultation_id
        and c.user_id = auth.uid()
    )
  );

create policy "Users can insert ingestion artifacts for own consultations"
  on ingestion_artifacts for insert
  with check (
    exists (
      select 1 from consultations c
      where c.id = ingestion_artifacts.consultation_id
        and c.user_id = auth.uid()
    )
  );

create policy "Users can update ingestion artifacts for own consultations"
  on ingestion_artifacts for update
  using (
    exists (
      select 1 from consultations c
      where c.id = ingestion_artifacts.consultation_id
        and c.user_id = auth.uid()
    )
  );

create trigger set_ingestion_artifacts_updated_at
  before update on ingestion_artifacts
  for each row
  execute function update_updated_at_column();

-- ============================================================
-- Indexes for common queries
-- ============================================================
create index idx_transcription_jobs_consultation_status on transcription_jobs(consultation_id, status);
create index idx_transcription_jobs_consultation_requested on transcription_jobs(consultation_id, requested_at desc);
create index idx_transcription_jobs_status on transcription_jobs(status);

create index idx_ocr_jobs_consultation_status on ocr_jobs(consultation_id, status);
create index idx_ocr_jobs_consultation_requested on ocr_jobs(consultation_id, requested_at desc);
create index idx_ocr_jobs_status on ocr_jobs(status);

create index idx_ingestion_artifacts_consultation_type on ingestion_artifacts(consultation_id, artifact_type);
create index idx_ingestion_artifacts_consultation_created on ingestion_artifacts(consultation_id, created_at desc);
create index idx_ingestion_artifacts_accepted on ingestion_artifacts(consultation_id, accepted);

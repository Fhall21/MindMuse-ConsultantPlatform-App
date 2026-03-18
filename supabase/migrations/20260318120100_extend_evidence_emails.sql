-- Extend evidence_emails table with status and lifecycle timestamps
-- PostgreSQL-portable: standard SQL

-- ============================================================
-- Extend evidence_emails table
-- ============================================================
alter table evidence_emails 
  add column status text not null default 'draft' check (status in ('draft', 'accepted', 'sent')),
  add column subject text,
  add column generated_at timestamptz,
  add column accepted_at timestamptz;

-- Rename sent_at comment/constraint for clarity (already exists from initial schema)
-- sent_at is already present in the table, represents when email was sent

-- ============================================================
-- Indexes for status and lifecycle queries
-- ============================================================
create index idx_evidence_emails_status on evidence_emails(status);
create index idx_evidence_emails_consultation_id_status on evidence_emails(consultation_id, status);

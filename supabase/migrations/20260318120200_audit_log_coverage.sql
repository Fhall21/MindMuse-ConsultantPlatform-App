-- Verify and extend audit_log table with required columns
-- PostgreSQL-portable: standard SQL

-- ============================================================
-- Extend audit_log table with additional columns
-- ============================================================
-- Add columns for detailed event tracking (action, entity_type, entity_id, metadata already exist)
alter table audit_log 
  add column if not exists entity_type text,
  add column if not exists entity_id uuid;

-- ============================================================
-- Comment confirming audit_log coverage
-- ============================================================
-- audit_log now has all required columns:
-- - id (uuid): unique event identifier
-- - consultation_id (uuid): FK to consultations
-- - action (text): event action string (e.g. 'consultation.created')
-- - payload (jsonb): compact context metadata (already present)
-- - entity_type (text): type of entity acted upon (e.g. 'consultation', 'theme')
-- - entity_id (uuid): ID of entity acted upon
-- - user_id (uuid): FK to auth.users
-- - created_at (timestamptz): event timestamp

-- ============================================================
-- Indexes for audit queries
-- ============================================================
create index if not exists idx_audit_log_entity_type on audit_log(entity_type);
create index if not exists idx_audit_log_entity_id on audit_log(entity_id);
create index if not exists idx_audit_log_action on audit_log(action);

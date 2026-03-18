-- Reconcile audit_log shape for databases created before audit coverage landed
-- PostgreSQL-portable: standard SQL

alter table if exists audit_log
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists payload jsonb;

alter table if exists audit_log
  alter column consultation_id drop not null;

create index if not exists idx_audit_log_entity_type on audit_log(entity_type);
create index if not exists idx_audit_log_entity_id on audit_log(entity_id);
create index if not exists idx_audit_log_action on audit_log(action);

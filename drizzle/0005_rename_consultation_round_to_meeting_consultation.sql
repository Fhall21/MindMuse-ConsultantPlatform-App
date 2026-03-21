-- Rename consultation_rounds → consultations
ALTER TABLE consultation_rounds RENAME TO consultations;

-- Rename consultations → meetings
ALTER TABLE consultations RENAME TO meetings;

-- Rename consultation_people → meeting_people
ALTER TABLE consultation_people RENAME TO meeting_people;

-- Rename consultation_groups → meeting_groups
ALTER TABLE consultation_groups RENAME TO meeting_groups;

-- Rename round_decisions → consultation_decisions
ALTER TABLE round_decisions RENAME TO consultation_decisions;

-- Rename round_output_artifacts → consultation_output_artifacts
ALTER TABLE round_output_artifacts RENAME TO consultation_output_artifacts;

-- Update FK column names in insights: consultation_id → meeting_id
ALTER TABLE insights RENAME COLUMN consultation_id TO meeting_id;
ALTER INDEX idx_insights_consultation_id RENAME TO idx_insights_meeting_id;

-- Update FK column names in evidence_emails: consultation_id → meeting_id
ALTER TABLE evidence_emails RENAME COLUMN consultation_id TO meeting_id;
ALTER INDEX idx_evidence_emails_consultation_id RENAME TO idx_evidence_emails_meeting_id;
ALTER INDEX idx_evidence_emails_consultation_id_status RENAME TO idx_evidence_emails_meeting_id_status;

-- Update FK column names in audit_log: consultation_id → meeting_id
ALTER TABLE audit_log RENAME COLUMN consultation_id TO meeting_id;
ALTER INDEX idx_audit_log_consultation_id RENAME TO idx_audit_log_meeting_id;

-- Update FK column names in transcription_jobs: consultation_id → meeting_id
ALTER TABLE transcription_jobs RENAME COLUMN consultation_id TO meeting_id;
ALTER INDEX idx_transcription_jobs_consultation_status RENAME TO idx_transcription_jobs_meeting_status;
ALTER INDEX idx_transcription_jobs_consultation_requested RENAME TO idx_transcription_jobs_meeting_requested;

-- Update FK column names in ocr_jobs: consultation_id → meeting_id
ALTER TABLE ocr_jobs RENAME COLUMN consultation_id TO meeting_id;
ALTER INDEX idx_ocr_jobs_consultation_status RENAME TO idx_ocr_jobs_meeting_status;
ALTER INDEX idx_ocr_jobs_consultation_requested RENAME TO idx_ocr_jobs_meeting_requested;

-- Update FK column names in ingestion_artifacts: consultation_id → meeting_id
ALTER TABLE ingestion_artifacts RENAME COLUMN consultation_id TO meeting_id;
ALTER INDEX idx_ingestion_artifacts_consultation_type RENAME TO idx_ingestion_artifacts_meeting_type;
ALTER INDEX idx_ingestion_artifacts_consultation_created RENAME TO idx_ingestion_artifacts_meeting_created;

-- Update FK column names in insight_decision_logs
ALTER TABLE insight_decision_logs RENAME COLUMN consultation_id TO meeting_id;
ALTER TABLE insight_decision_logs RENAME COLUMN round_id TO consultation_id;
ALTER INDEX idx_insight_decision_logs_consultation_id RENAME TO idx_insight_decision_logs_meeting_id;
ALTER INDEX idx_insight_decision_logs_round_id RENAME TO idx_insight_decision_logs_consultation_id;
ALTER INDEX idx_insight_decision_logs_user_consultation_created RENAME TO idx_insight_decision_logs_user_meeting_created;

-- Update FK column names in themes: round_id → consultation_id
ALTER TABLE themes RENAME COLUMN round_id TO consultation_id;
ALTER INDEX idx_themes_round_id RENAME TO idx_themes_consultation_id;
ALTER INDEX idx_themes_user_round_status RENAME TO idx_themes_user_consultation_status;

-- Update FK column names in theme_members
ALTER TABLE theme_members RENAME COLUMN round_id TO consultation_id;
ALTER TABLE theme_members RENAME COLUMN source_consultation_id TO source_meeting_id;
ALTER INDEX idx_theme_members_round_id RENAME TO idx_theme_members_consultation_id;
ALTER INDEX theme_members_round_insight_key RENAME TO theme_members_consultation_insight_key;

-- Update FK column names in consultation_decisions (formerly round_decisions): round_id → consultation_id
ALTER TABLE consultation_decisions RENAME COLUMN round_id TO consultation_id;
ALTER INDEX idx_round_decisions_round_target RENAME TO idx_consultation_decisions_consultation_target;

-- Update FK column names in consultation_output_artifacts (formerly round_output_artifacts): round_id → consultation_id
ALTER TABLE consultation_output_artifacts RENAME COLUMN round_id TO consultation_id;
ALTER INDEX idx_round_output_artifacts_round_type RENAME TO idx_consultation_output_artifacts_consultation_type;

-- Update FK column names in meeting_groups (formerly consultation_groups): round_id → consultation_id
ALTER TABLE meeting_groups RENAME COLUMN round_id TO consultation_id;
ALTER INDEX idx_consultation_groups_round_id RENAME TO idx_meeting_groups_consultation_id;
ALTER INDEX idx_consultation_groups_user_round RENAME TO idx_meeting_groups_user_consultation;

-- Update FK column names in consultation_group_members
ALTER TABLE consultation_group_members RENAME COLUMN round_id TO consultation_id;
ALTER TABLE consultation_group_members RENAME COLUMN consultation_id TO meeting_id;
ALTER INDEX idx_consultation_group_members_round_id RENAME TO idx_consultation_group_members_consultation_id;
ALTER INDEX idx_consultation_group_members_consultation_id RENAME TO idx_consultation_group_members_meeting_id;
ALTER INDEX consultation_group_members_round_consultation_key RENAME TO consultation_group_members_consultation_meeting_key;

-- Update FK column names in canvas_connections: round_id → consultation_id
ALTER TABLE canvas_connections RENAME COLUMN round_id TO consultation_id;
ALTER INDEX idx_canvas_connections_round_user_created RENAME TO idx_canvas_connections_consultation_user_created;

-- Update CHECK constraints that reference old column names
ALTER TABLE consultation_decisions DROP CONSTRAINT round_decisions_target_type_check;
ALTER TABLE consultation_decisions ADD CONSTRAINT consultation_decisions_target_type_check CHECK (target_type in ('source_theme', 'theme_group', 'round_output'));

ALTER TABLE consultation_decisions DROP CONSTRAINT round_decisions_decision_type_check;
ALTER TABLE consultation_decisions ADD CONSTRAINT consultation_decisions_decision_type_check CHECK (decision_type in ('accepted', 'discarded', 'management_rejected'));

ALTER TABLE consultation_decisions DROP CONSTRAINT round_decisions_management_rejected_requires_rationale;
ALTER TABLE consultation_decisions ADD CONSTRAINT consultation_decisions_management_rejected_requires_rationale CHECK (decision_type <> 'management_rejected' or (rationale is not null and btrim(rationale) <> ''));

ALTER TABLE consultation_output_artifacts DROP CONSTRAINT round_output_artifacts_artifact_type_check;
ALTER TABLE consultation_output_artifacts ADD CONSTRAINT consultation_output_artifacts_artifact_type_check CHECK (artifact_type in ('summary', 'report', 'email'));

ALTER TABLE consultation_output_artifacts DROP CONSTRAINT round_output_artifacts_status_check;
ALTER TABLE consultation_output_artifacts ADD CONSTRAINT consultation_output_artifacts_status_check CHECK (status in ('generated'));

ALTER TABLE meeting_groups DROP CONSTRAINT consultation_groups_position_check;
ALTER TABLE meeting_groups ADD CONSTRAINT meeting_groups_position_check CHECK (position >= 0);

ALTER TABLE consultation_group_members DROP CONSTRAINT consultation_group_members_position_check;
ALTER TABLE consultation_group_members ADD CONSTRAINT consultation_group_members_position_check CHECK (position >= 0);

-- Create new phases table
CREATE TABLE phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('discovery', 'discussion', 'review_feedback')),
  label TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_phases_meeting_id ON phases(meeting_id);
CREATE INDEX idx_phases_type ON phases(type);

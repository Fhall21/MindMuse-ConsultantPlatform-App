export type ConsultationStatus = "draft" | "complete";

export interface Consultation {
  id: string;
  title: string;
  transcript_raw: string | null;
  // TODO: Agent 1 — add `notes text` column to consultations migration
  notes?: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  status: ConsultationStatus;
  round_id: string | null;
}

export interface ConsultationRound {
  id: string;
  user_id: string;
  label: string;
  description: string | null;
  created_at: string;
}

export type ThemeStatus =
  | "draft"
  | "accepted"
  | "discarded"
  | "management_rejected";

export type ThemeOrigin = "manual" | "ai_refined";

export interface Theme {
  id: string;
  round_id: string;
  user_id: string;
  label: string;
  description: string | null;
  status: ThemeStatus;
  origin: ThemeOrigin;
  ai_draft_label: string | null;
  ai_draft_description: string | null;
  ai_draft_explanation: string | null;
  ai_draft_created_at: string | null;
  ai_draft_created_by: string | null;
  last_structural_change_at: string;
  last_structural_change_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ThemeMember {
  id: string;
  theme_id: string;
  round_id: string;
  insight_id: string;
  source_consultation_id: string;
  user_id: string;
  position: number;
  created_by: string;
  created_at: string;
}

export type RoundDecisionTargetType =
  | "source_theme"
  | "theme_group"
  | "round_output";

export type RoundDecisionType =
  | "accepted"
  | "discarded"
  | "management_rejected";

export interface RoundDecision {
  id: string;
  round_id: string;
  user_id: string;
  target_type: RoundDecisionTargetType;
  target_id: string;
  decision_type: RoundDecisionType;
  rationale: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type RoundOutputArtifactType = "summary" | "report" | "email";
export type RoundOutputArtifactStatus = "generated";

export interface RoundOutputArtifact {
  id: string;
  round_id: string;
  user_id: string;
  artifact_type: RoundOutputArtifactType;
  status: RoundOutputArtifactStatus;
  title: string | null;
  content: string;
  input_snapshot: Record<string, unknown>;
  generated_at: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface Insight {
  id: string;
  consultation_id: string;
  label: string;
  description: string | null;
  accepted: boolean;
  is_user_added: boolean;
  weight: number;
  created_at: string;
}

export type InsightDecisionType = "accept" | "reject" | "user_added";

export interface InsightDecisionLog {
  id: string;
  user_id: string;
  consultation_id: string;
  insight_id: string | null;
  insight_label: string;
  round_id: string | null;
  decision_type: InsightDecisionType;
  rationale: string | null;
  created_at: string;
}

export interface Person {
  id: string;
  name: string;
  working_group: string | null;
  work_type: string | null;
  role: string | null;
  email: string | null;
  created_at: string;
  user_id: string;
}

export interface ConsultationPerson {
  consultation_id: string;
  person_id: string;
}

export interface EvidenceEmail {
  id: string;
  consultation_id: string;
  subject: string | null;
  body_draft: string | null;
  body_final: string | null;
  status: string; // 'draft' | 'accepted' | 'sent'
  generated_at: string | null;
  accepted_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  consultation_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  user_id: string;
}

export type IngestionStatus = "queued" | "processing" | "completed" | "failed";
export type IngestionArtifactType =
  | "transcript_file"
  | "transcript_paste"
  | "audio"
  | "ocr_image"
  | "clarification_response";

export interface TranscriptionJob {
  id: string;
  consultation_id: string;
  audio_file_key: string;
  status: IngestionStatus;
  transcript_text: string | null;
  error_message: string | null;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OcrJob {
  id: string;
  consultation_id: string;
  image_file_key: string;
  status: IngestionStatus;
  extracted_text: string | null;
  confidence_score: number | null;
  error_message: string | null;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ReportTemplatePrescriptiveness = "flexible" | "moderate" | "strict";

export interface ReportTemplateSection {
  heading: string;
  purpose: string;
  prose_guidance: string;
  example_excerpt: string | null;
}

export interface ReportTemplateStyleNotes {
  tone: string | null;
  person: string | null;
  formatting_notes: string | null;
}

export interface ReportTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  sections: ReportTemplateSection[];
  style_notes: ReportTemplateStyleNotes;
  prescriptiveness: ReportTemplatePrescriptiveness;
  source_file_names: string[];
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface IngestionArtifact {
  id: string;
  consultation_id: string;
  artifact_type: IngestionArtifactType;
  source_file_key: string;
  metadata: Record<string, unknown> | null;
  accepted: boolean | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserAIPreferences {
  id: string;
  user_id: string;
  consultation_types: string[];
  focus_areas: string[];
  excluded_topics: string[];
  created_at: string;
  updated_at: string;
}

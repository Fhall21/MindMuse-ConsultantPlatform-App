export type ConsultationStatus = "draft" | "complete";

// Meeting type taxonomy managed in Settings → Meeting Types.
// Code is a short user-defined string shown in generated titles (e.g. "FC", "1-1").
// Use is_active=false to retire an option without breaking old records.
export interface MeetingType {
  id: string;
  user_id: string;
  label: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  title: string;
  label: string;
  transcript_raw: string | null;
  description: string | null;
  // TODO: Agent 1 — add `notes text` column to meetings migration
  notes?: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  status: ConsultationStatus;
  is_archived: boolean;
  consultation_id: string | null;
  consultation_label?: string | null;
  people_names?: string[];
  // Structured fields used to generate the coded title (nullable for legacy records)
  meeting_type_id: string | null;
  meeting_date: string | null;
}

export interface Consultation {
  id: string;
  user_id: string;
  label: string;
  description: string | null;
  created_at: string;
  title?: string;
  transcript_raw?: string | null;
  updated_at?: string;
  status?: ConsultationStatus;
  round_id?: string | null;
}

export type ThemeStatus =
  | "draft"
  | "accepted"
  | "discarded"
  | "management_rejected";

export type ThemeOrigin = "manual" | "ai_refined";

export interface Theme {
  id: string;
  consultation_id: string;
  meeting_id?: string;
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
  consultation_id: string;
  insight_id: string;
  source_meeting_id: string;
  source_meeting_ids: string[];
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

export interface ConsultationDecision {
  id: string;
  consultation_id: string;
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

export interface ConsultationOutputArtifact {
  id: string;
  consultation_id: string;
  meeting_id?: string;
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
  meeting_id: string;
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
  meeting_id: string;
  insight_id: string | null;
  insight_label: string;
  consultation_id: string | null;
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

export interface MeetingPerson {
  meeting_id: string;
  person_id: string;
}

export interface EvidenceEmail {
  id: string;
  meeting_id: string;
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
  meeting_id: string | null;
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
  meeting_id: string;
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
  meeting_id: string;
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
  /** Multi-photo batch: all pages in one upload share this UUID. Null for pre-batch single-page uploads. */
  batch_id: string | null;
  /** 0-based page sequence within a batch. Null for pre-batch single-page uploads. */
  image_sequence: number | null;
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
  suggestions: Array<{
    id: string;
    text: string;
    created_at: string;
  }>;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface IngestionArtifact {
  id: string;
  meeting_id: string;
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

export type AILearningTopicType = "theme_generation";

export type AILearningType =
  | "process_pattern"
  | "trend"
  | "rejection_signal"
  | "preference_alignment";

export interface AIInsightLearningSupportingMetrics {
  accepted_count?: number;
  alignment_count?: number;
  confidence_score?: number;
  example_labels?: string[];
  percentage?: number;
  preference_labels?: string[];
  rejection_count?: number;
  rejection_reasons?: Record<string, number>;
  [key: string]: unknown;
}

export interface AIInsightLearning {
  id: string;
  user_id: string;
  topic_type: AILearningTopicType;
  learning_type: AILearningType;
  label: string;
  description: string;
  supporting_metrics: AIInsightLearningSupportingMetrics;
  created_at: string;
  expires_at: string | null;
  version: number;
}

export type PhaseType = "discovery" | "discussion" | "review_feedback";

export interface Phase {
  id: string;
  meeting_id: string;
  type: PhaseType;
  label: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

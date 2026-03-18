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

export interface Theme {
  id: string;
  consultation_id: string;
  label: string;
  description: string | null;
  accepted: boolean;
  is_user_added: boolean;
  weight: number;
  created_at: string;
}

export type ThemeDecisionType = "accept" | "reject" | "user_added";

export interface ThemeDecisionLog {
  id: string;
  user_id: string;
  consultation_id: string;
  theme_id: string;
  round_id: string | null;
  decision_type: ThemeDecisionType;
  rationale: string | null;
  created_at: string;
}

export interface Person {
  id: string;
  name: string;
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

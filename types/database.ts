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

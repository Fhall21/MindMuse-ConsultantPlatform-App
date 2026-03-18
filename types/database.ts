export type ConsultationStatus = "draft" | "complete";

export interface Consultation {
  id: string;
  title: string;
  transcript_raw: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  status: ConsultationStatus;
}

export interface Theme {
  id: string;
  consultation_id: string;
  label: string;
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
  body_draft: string | null;
  body_final: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  consultation_id: string;
  action: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  user_id: string;
}

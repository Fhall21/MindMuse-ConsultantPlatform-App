import {
  auditLog,
  consultations,
  meetings,
  evidenceEmails,
  insights,
  people,
  consultationOutputArtifacts as roundOutputArtifacts,
  themes,
} from "@/db/schema";
import type {
  AuditLogEntry,
  Consultation,
  ConsultationRound,
  EvidenceEmail,
  Insight,
  Meeting,
  Person,
  RoundOutputArtifact,
  Theme,
} from "@/types/db";

type ConsultationRow = typeof consultations.$inferSelect;
type ConsultationRoundRow = typeof meetings.$inferSelect;
type MeetingRow = typeof meetings.$inferSelect;
type InsightRow = typeof insights.$inferSelect;
type ThemeRow = typeof themes.$inferSelect;
type PersonRow = typeof people.$inferSelect;
type EvidenceEmailRow = typeof evidenceEmails.$inferSelect;
type AuditLogRow = typeof auditLog.$inferSelect;
type RoundOutputArtifactRow = typeof roundOutputArtifacts.$inferSelect;

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function mapConsultationRecord(row: ConsultationRow): Consultation {
  return {
    id: row.id,
    user_id: row.userId,
    label: row.label,
    description: row.description,
    created_at: row.createdAt.toISOString(),
  };
}

export function mapConsultationRoundRecord(
  row: ConsultationRoundRow
): ConsultationRound {
  return {
    id: row.id,
    title: row.title,
    label: row.title,
    transcript_raw: row.transcriptRaw ?? null,
    description: null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    user_id: row.userId,
    status: row.status as ConsultationRound["status"],
    consultation_id: row.consultationId,
    meeting_type_id: (row as { meetingTypeId?: string | null }).meetingTypeId ?? null,
    meeting_date: (row as { meetingDate?: Date | null }).meetingDate?.toISOString() ?? null,
  };
}

export function mapMeetingRecord(row: MeetingRow): Meeting {
  return {
    id: row.id,
    title: row.title,
    label: row.title,
    transcript_raw: row.transcriptRaw ?? null,
    description: null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    user_id: row.userId,
    status: row.status as Meeting["status"],
    consultation_id: row.consultationId,
    meeting_type_id: (row as { meetingTypeId?: string | null }).meetingTypeId ?? null,
    meeting_date: (row as { meetingDate?: Date | null }).meetingDate?.toISOString() ?? null,
  };
}

export function mapInsightRecord(row: InsightRow): Insight {
  return {
    id: row.id,
    meeting_id: row.meetingId,
    label: row.label,
    description: row.description,
    accepted: row.accepted,
    is_user_added: row.isUserAdded,
    weight: toNumber(row.weight),
    created_at: row.createdAt.toISOString(),
  };
}

export function mapThemeRecord(row: ThemeRow): Theme {
  return {
    id: row.id,
    consultation_id: row.consultationId,
    user_id: row.userId,
    label: row.label,
    description: row.description,
    status: row.status as Theme["status"],
    origin: row.origin as Theme["origin"],
    ai_draft_label: row.aiDraftLabel,
    ai_draft_description: row.aiDraftDescription,
    ai_draft_explanation: row.aiDraftExplanation,
    ai_draft_created_at: row.aiDraftCreatedAt?.toISOString() ?? null,
    ai_draft_created_by: row.aiDraftCreatedBy,
    last_structural_change_at: row.lastStructuralChangeAt.toISOString(),
    last_structural_change_by: row.lastStructuralChangeBy,
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function mapPersonRecord(row: PersonRow): Person {
  return {
    id: row.id,
    name: row.name,
    working_group: row.workingGroup,
    work_type: row.workType,
    role: row.role,
    email: row.email,
    created_at: row.createdAt.toISOString(),
    user_id: row.userId,
  };
}

export function mapEvidenceEmailRecord(row: EvidenceEmailRow): EvidenceEmail {
  return {
    id: row.id,
    meeting_id: row.meetingId,
    subject: row.subject,
    body_draft: row.bodyDraft,
    body_final: row.bodyFinal,
    status: row.status,
    generated_at: toIsoString(row.generatedAt),
    accepted_at: toIsoString(row.acceptedAt),
    sent_at: toIsoString(row.sentAt),
    created_at: row.createdAt.toISOString(),
  };
}

export function mapAuditLogRecord(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    meeting_id: row.meetingId,
    consultation_id:
      (typeof row.payload?.consultation_id === "string"
        ? row.payload.consultation_id
        : typeof row.payload?.consultationId === "string"
          ? row.payload.consultationId
          : null),
    action: row.action,
    entity_type: row.entityType,
    entity_id: row.entityId,
    payload: row.payload,
    created_at: row.createdAt.toISOString(),
    user_id: row.userId,
  };
}

export function mapRoundOutputArtifactRecord(
  row: RoundOutputArtifactRow
): RoundOutputArtifact {
  return {
    id: row.id,
    consultation_id: row.consultationId,
    user_id: row.userId,
    artifact_type: row.artifactType as RoundOutputArtifact["artifact_type"],
    status: row.status as RoundOutputArtifact["status"],
    title: row.title,
    content: row.content,
    input_snapshot: row.inputSnapshot,
    generated_at: row.generatedAt.toISOString(),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    created_by: row.createdBy,
  };
}

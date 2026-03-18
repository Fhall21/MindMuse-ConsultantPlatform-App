"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  AuditExportConsultationRecord,
  AuditExportEvent,
  AuditExportFilters,
  AuditExportLifecycleMarker,
  AuditExportPackage,
  AuditLogEntry,
  Consultation,
  ConsultationRound,
  EvidenceEmail,
  Theme,
} from "@/types/db";

const ACTION_LABELS: Record<string, string> = {
  "consultation.created": "Consultation created",
  "consultation.transcript_edited": "Transcript updated",
  "consultation.completed": "Consultation marked complete",
  "person.created": "Person created",
  "person.updated": "Person updated",
  "person.deleted": "Person deleted",
  "person.linked": "Person linked",
  "person.unlinked": "Person unlinked",
  "theme.extraction_requested": "Theme extraction requested",
  "theme.accepted": "Theme accepted",
  "theme.rejected": "Theme rejected",
  "evidence_email.generation_requested": "Evidence email generation requested",
  "evidence_email.generated": "Evidence email draft generated",
  "evidence_email.accepted": "Evidence email accepted",
  "evidence_email.sent": "Evidence email marked sent",
};

const LIFECYCLE_STAGES: Array<[prefix: string, stage: string]> = [
  ["consultation.", "consultation"],
  ["ingestion.", "ingestion"],
  ["transcription.", "transcription"],
  ["ocr.", "ocr"],
  ["clarification.", "clarification"],
  ["theme.", "theme"],
  ["evidence_email.", "evidence_email"],
  ["person.", "person"],
];

function humanizeAction(action: string) {
  return action
    .split(".")
    .join(" ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getActionLabel(action: string) {
  return ACTION_LABELS[action] ?? humanizeAction(action);
}

function getLifecycleStage(action: string) {
  const matchedEntry = LIFECYCLE_STAGES.find(([prefix]) => action.startsWith(prefix));
  return matchedEntry?.[1] ?? "other";
}

function normalizeDateBoundary(value: string | null | undefined, boundary: "start" | "end") {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return null;
  }

  const suffix = boundary === "start" ? "T00:00:00.000Z" : "T00:00:00.000Z";
  const baseDate = new Date(`${trimmedValue}${suffix}`);

  if (Number.isNaN(baseDate.getTime())) {
    return null;
  }

  if (boundary === "end") {
    baseDate.setUTCDate(baseDate.getUTCDate() + 1);
  }

  return baseDate.toISOString();
}

function normalizeFilters(filters: AuditExportFilters = {}): Required<AuditExportFilters> {
  const dateFrom = filters.dateFrom?.trim() ? filters.dateFrom.trim() : null;
  const dateTo = filters.dateTo?.trim() ? filters.dateTo.trim() : null;
  const consultationId = filters.consultationId?.trim() ? filters.consultationId.trim() : null;
  const userId = filters.userId?.trim() ? filters.userId.trim() : null;

  return {
    dateFrom,
    dateTo,
    consultationId,
    userId,
  };
}

function validateDateRange(dateFromIso: string | null, dateToIso: string | null) {
  if (!dateFromIso || !dateToIso) {
    return;
  }

  if (new Date(dateFromIso).getTime() >= new Date(dateToIso).getTime()) {
    throw new Error("Date range is invalid. Choose an end date after the start date.");
  }
}

function buildFilenameBase(filters: Required<AuditExportFilters>) {
  const today = new Date().toISOString().slice(0, 10);
  const segments = ["audit-export", today];

  if (filters.consultationId) {
    segments.push("consultation");
  }

  if (filters.userId) {
    segments.push("user");
  }

  if (filters.dateFrom || filters.dateTo) {
    segments.push("dated");
  }

  return segments.join("-");
}

function buildArtifactSummary(
  themes: Theme[],
  evidenceEmails: EvidenceEmail[]
): AuditExportConsultationRecord["artifactSummary"] {
  const acceptedThemeCount = themes.filter((theme) => theme.accepted).length;
  const latestEvidenceEmail = evidenceEmails.at(-1) ?? null;

  return {
    themeCount: themes.length,
    acceptedThemeCount,
    rejectedThemeCount: themes.length - acceptedThemeCount,
    evidenceEmailCount: evidenceEmails.length,
    latestEvidenceEmailStatus: latestEvidenceEmail?.status ?? null,
    evidenceEmailGeneratedAt: latestEvidenceEmail?.generated_at ?? null,
    evidenceEmailAcceptedAt: latestEvidenceEmail?.accepted_at ?? null,
    evidenceEmailSentAt: latestEvidenceEmail?.sent_at ?? null,
  };
}

function toExportEvent(event: AuditLogEntry): AuditExportEvent {
  return {
    id: event.id,
    consultationId: event.consultation_id,
    timestamp: event.created_at,
    action: event.action,
    label: getActionLabel(event.action),
    lifecycleStage: getLifecycleStage(event.action),
    entityType: event.entity_type,
    entityId: event.entity_id,
    userId: event.user_id,
    payload: event.payload,
  };
}

function buildLifecycleMarkers(events: AuditExportEvent[]): AuditExportLifecycleMarker[] {
  return events
    .filter((event) => event.lifecycleStage !== "person")
    .map((event) => ({
      action: event.action,
      label: event.label,
      timestamp: event.timestamp,
      userId: event.userId,
    }));
}

function buildConsultationRecord(params: {
  consultation: Consultation | null;
  roundLabel: string | null;
  events: AuditExportEvent[];
  themes: Theme[];
  evidenceEmails: EvidenceEmail[];
}): AuditExportConsultationRecord {
  const { consultation, roundLabel, events, themes, evidenceEmails } = params;

  return {
    consultationId: consultation?.id ?? null,
    title: consultation?.title ?? "Unlinked consultation events",
    roundLabel,
    status: consultation?.status ?? null,
    userId: consultation?.user_id ?? (events[0]?.userId ?? null),
    createdAt: consultation?.created_at ?? null,
    updatedAt: consultation?.updated_at ?? null,
    chronology: events,
    lifecycleMarkers: buildLifecycleMarkers(events),
    artifactSummary: buildArtifactSummary(themes, evidenceEmails),
  };
}

export async function generateAuditExport(
  rawFilters: AuditExportFilters = {}
): Promise<AuditExportPackage> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    throw new Error("Not authenticated");
  }

  const filters = normalizeFilters(rawFilters);
  const dateFromIso = normalizeDateBoundary(filters.dateFrom, "start");
  const dateToIso = normalizeDateBoundary(filters.dateTo, "end");

  validateDateRange(dateFromIso, dateToIso);

  let auditQuery = supabase.from("audit_log").select("*").order("created_at", { ascending: true });

  if (filters.consultationId) {
    auditQuery = auditQuery.eq("consultation_id", filters.consultationId);
  }

  if (filters.userId) {
    auditQuery = auditQuery.eq("user_id", filters.userId);
  }

  if (dateFromIso) {
    auditQuery = auditQuery.gte("created_at", dateFromIso);
  }

  if (dateToIso) {
    auditQuery = auditQuery.lt("created_at", dateToIso);
  }

  const { data: auditRows, error: auditError } = await auditQuery;

  if (auditError) {
    console.error("Audit export query failed:", auditError);
    throw new Error("Unable to load audit events for export. Please retry.");
  }

  const auditEvents = (auditRows ?? []) as AuditLogEntry[];

  const consultationIds = Array.from(
    new Set(
      auditEvents
        .map((event) => event.consultation_id)
        .filter((consultationId): consultationId is string => Boolean(consultationId))
    )
  );

  let consultations: Consultation[] = [];
  let evidenceEmails: EvidenceEmail[] = [];
  let themes: Theme[] = [];
  let rounds: ConsultationRound[] = [];

  if (consultationIds.length > 0) {
    const [
      consultationsResult,
      evidenceEmailsResult,
      themesResult,
    ] = await Promise.all([
      supabase
        .from("consultations")
        .select("*")
        .in("id", consultationIds)
        .order("created_at", { ascending: true }),
      supabase
        .from("evidence_emails")
        .select("*")
        .in("consultation_id", consultationIds)
        .order("created_at", { ascending: true }),
      supabase
        .from("themes")
        .select("*")
        .in("consultation_id", consultationIds)
        .order("created_at", { ascending: true }),
    ]);

    if (consultationsResult.error) {
      console.error("Consultation query for audit export failed:", consultationsResult.error);
      throw new Error("Unable to load consultation details for export. Please retry.");
    }

    if (evidenceEmailsResult.error) {
      console.error("Evidence email query for audit export failed:", evidenceEmailsResult.error);
      throw new Error("Unable to load evidence email details for export. Please retry.");
    }

    if (themesResult.error) {
      console.error("Theme query for audit export failed:", themesResult.error);
      throw new Error("Unable to load theme details for export. Please retry.");
    }

    consultations = (consultationsResult.data ?? []) as Consultation[];
    evidenceEmails = (evidenceEmailsResult.data ?? []) as EvidenceEmail[];
    themes = (themesResult.data ?? []) as Theme[];

    const roundIds = Array.from(
      new Set(
        consultations
          .map((consultation) => consultation.round_id)
          .filter((roundId): roundId is string => Boolean(roundId))
      )
    );

    if (roundIds.length > 0) {
      const { data: roundRows, error: roundsError } = await supabase
        .from("consultation_rounds")
        .select("*")
        .in("id", roundIds);

      if (roundsError) {
        console.error("Consultation round query for audit export failed:", roundsError);
        throw new Error("Unable to load consultation round details for export. Please retry.");
      }

      rounds = (roundRows ?? []) as ConsultationRound[];
    }
  }

  const consultationById = new Map(consultations.map((consultation) => [consultation.id, consultation]));
  const roundLabelById = new Map(rounds.map((round) => [round.id, round.label]));

  const eventsByConsultationId = new Map<string, AuditExportEvent[]>();

  for (const event of auditEvents) {
    const exportEvent = toExportEvent(event);
    const key = exportEvent.consultationId ?? "__unlinked__";
    const currentEvents = eventsByConsultationId.get(key) ?? [];
    currentEvents.push(exportEvent);
    eventsByConsultationId.set(key, currentEvents);
  }

  const themesByConsultationId = themes.reduce<Map<string, Theme[]>>((accumulator, theme) => {
    const currentThemes = accumulator.get(theme.consultation_id) ?? [];
    currentThemes.push(theme);
    accumulator.set(theme.consultation_id, currentThemes);
    return accumulator;
  }, new Map<string, Theme[]>());

  const evidenceEmailsByConsultationId = evidenceEmails.reduce<Map<string, EvidenceEmail[]>>(
    (accumulator, evidenceEmail) => {
      const currentEvidenceEmails = accumulator.get(evidenceEmail.consultation_id) ?? [];
      currentEvidenceEmails.push(evidenceEmail);
      accumulator.set(evidenceEmail.consultation_id, currentEvidenceEmails);
      return accumulator;
    },
    new Map<string, EvidenceEmail[]>()
  );

  const consultationRecords = Array.from(eventsByConsultationId.entries()).map(([key, events]) => {
    const consultation = key === "__unlinked__" ? null : (consultationById.get(key) ?? null);
    const roundLabel =
      consultation?.round_id ? (roundLabelById.get(consultation.round_id) ?? null) : null;

    return buildConsultationRecord({
      consultation,
      roundLabel,
      events,
      themes: consultation ? (themesByConsultationId.get(consultation.id) ?? []) : [],
      evidenceEmails: consultation ? (evidenceEmailsByConsultationId.get(consultation.id) ?? []) : [],
    });
  });

  const userCount = new Set(auditEvents.map((event) => event.user_id)).size;

  return {
    generatedAt: new Date().toISOString(),
    filenameBase: buildFilenameBase(filters),
    filters,
    summary: {
      consultationCount: consultationRecords.length,
      eventCount: auditEvents.length,
      userCount,
    },
    consultations: consultationRecords,
  };
}

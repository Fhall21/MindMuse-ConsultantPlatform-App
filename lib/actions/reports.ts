"use server";

import { requireCurrentUserId } from "@/lib/data/auth-context";
import {
  getConsultationForUser,
  getMeetingForUser,
  getRoundOutputArtifactForUser,
  listAuditEventsForUser,
  listConsultationsByIdsForUser,
  listDraftThemesForRound,
  listInsightsForMeeting,
  listInsightsForMeetings,
  listMeetingsForConsultation,
  listPeopleForMeeting,
  listRoundOutputArtifactsForRound,
  listRoundOutputArtifactsForUser,
} from "@/lib/data/domain-read";
import type {
  AuditLogEntry,
  Consultation,
  ConsultationRound,
  Insight,
  Meeting,
} from "@/types/db";
import {
  buildReportGraphModel,
  getAcceptedConsultationThemes,
  getMeetingTitles,
  getSupportingMeetingThemes,
  toReportInputSnapshot,
  type ReportInputSnapshot,
} from "@/lib/report-graph";

type MeetingContext = Pick<Meeting, "id" | "title" | "consultation_id">;
type ConsultationContext = Pick<Consultation, "id" | "label" | "description">;

export interface ThemeProvenanceContext {
  consultationId: string | null;
  consultationTitle: string | null;
  roundId: string | null;
  roundLabel: string | null;
  isUserAdded: boolean;
}

export interface ReportThemeReference {
  key: string;
  label: string;
  sourceKind: "consultation" | "round";
  decisionStatus: "accepted" | "rejected";
  rationale: string | null;
  provenance: ThemeProvenanceContext[];
}

export interface IncludedThemeSelection {
  label: string;
  sourceKinds: Array<"consultation" | "round">;
  provenance: ThemeProvenanceContext[];
}

export interface RoundSummaryData {
  roundId: string;
  roundLabel: string;
  roundDescription: string | null;
  linkedConsultationCount: number;
  acceptedThemes: ReportThemeReference[];
  rejectedThemes: ReportThemeReference[];
}

export interface ConsultationReportData {
  consultationId: string;
  consultationTitle: string;
  roundId: string | null;
  roundLabel: string | null;
  consultationThemes: ReportThemeReference[];
  roundThemes: ReportThemeReference[];
  rejectedThemes: ReportThemeReference[];
  includedThemes: IncludedThemeSelection[];
  roundSummary: RoundSummaryData | null;
}

function getStringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeLabel(label: string) {
  return label.trim().toLowerCase();
}

function dedupeProvenance(
  provenance: ThemeProvenanceContext[]
): ThemeProvenanceContext[] {
  const seen = new Set<string>();

  return provenance.filter((entry) => {
    const key = [
      entry.consultationId ?? "",
      entry.consultationTitle ?? "",
      entry.roundId ?? "",
      entry.roundLabel ?? "",
      entry.isUserAdded ? "user" : "ai",
    ].join("::");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildProvenanceContext(params: {
  consultation: MeetingContext | null;
  round: ConsultationContext | null;
  isUserAdded: boolean;
}): ThemeProvenanceContext {
  const { consultation, round, isUserAdded } = params;

  return {
    consultationId: consultation?.id ?? null,
    consultationTitle: consultation?.title ?? null,
    roundId: round?.id ?? consultation?.consultation_id ?? null,
    roundLabel: round?.label ?? null,
    isUserAdded,
  };
}

function buildAcceptedConsultationThemeReference(params: {
  theme: Insight;
  consultation: MeetingContext;
  round: ConsultationContext | null;
}): ReportThemeReference {
  const { theme, consultation, round } = params;

  return {
    key: `consultation:${theme.id}`,
    label: theme.label,
    sourceKind: "consultation",
    decisionStatus: "accepted",
    rationale: null,
    provenance: [
      buildProvenanceContext({
        consultation,
        round,
        isUserAdded: theme.is_user_added,
      }),
    ],
  };
}

function collateRoundAcceptedThemes(params: {
  themes: Insight[];
  consultationById: Map<string, MeetingContext>;
  round: ConsultationContext;
}): ReportThemeReference[] {
  const { themes, consultationById, round } = params;
  const grouped = new Map<
    string,
    {
      label: string;
      provenance: ThemeProvenanceContext[];
    }
  >();

  themes.forEach((theme) => {
    const key = normalizeLabel(theme.label);
    const consultationId = theme.meeting_id;
    const consultation = consultationId
      ? (consultationById.get(consultationId) ?? null)
      : null;
    const existing = grouped.get(key);
    const nextProvenance = buildProvenanceContext({
      consultation,
      round,
      isUserAdded: theme.is_user_added,
    });

    if (existing) {
      existing.provenance.push(nextProvenance);
      return;
    }

    grouped.set(key, {
      label: theme.label,
      provenance: [nextProvenance],
    });
  });

  return Array.from(grouped.entries())
    .map(([key, value]) => ({
      key: `round:${round.id}:${key}`,
      label: value.label,
      sourceKind: "round" as const,
      decisionStatus: "accepted" as const,
      rationale: null,
      provenance: dedupeProvenance(value.provenance),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function buildRejectedThemeReference(params: {
  event: AuditLogEntry;
  consultationById: Map<string, MeetingContext>;
  roundById: Map<string, ConsultationContext>;
}): ReportThemeReference | null {
  const { event, consultationById, roundById } = params;
  const payload = event.payload ?? {};
  const rationale = getStringValue(payload.rationale);

  if (!rationale) {
    return null;
  }

  const roundId =
    getStringValue(payload.consultation_id) ?? getStringValue(payload.round_id);
  const meetingId = event.meeting_id ?? event.consultation_id;
  const consultation = meetingId
    ? (consultationById.get(meetingId) ?? null)
    : null;
  const derivedRoundId = roundId ?? consultation?.consultation_id ?? null;
  const round = derivedRoundId ? (roundById.get(derivedRoundId) ?? null) : null;
  const label = getStringValue(payload.theme_label) ?? "Rejected theme";

  return {
    key: `rejected:${event.id}`,
    label,
    sourceKind: round ? "round" : "consultation",
    decisionStatus: "rejected",
    rationale,
    provenance: [
      buildProvenanceContext({
        consultation,
        round,
        isUserAdded: false,
      }),
    ],
  };
}

function buildIncludedThemes(
  consultationThemes: ReportThemeReference[],
  roundThemes: ReportThemeReference[]
): IncludedThemeSelection[] {
  const grouped = new Map<
    string,
    {
      label: string;
      sourceKinds: Set<"consultation" | "round">;
      provenance: ThemeProvenanceContext[];
    }
  >();

  [...consultationThemes, ...roundThemes].forEach((theme) => {
    const key = normalizeLabel(theme.label);
    const existing = grouped.get(key);

    if (existing) {
      existing.sourceKinds.add(theme.sourceKind);
      existing.provenance.push(...theme.provenance);
      return;
    }

    grouped.set(key, {
      label: theme.label,
      sourceKinds: new Set([theme.sourceKind]),
      provenance: [...theme.provenance],
    });
  });

  return Array.from(grouped.values())
    .map((theme) => ({
      label: theme.label,
      sourceKinds: Array.from(theme.sourceKinds).sort(),
      provenance: dedupeProvenance(theme.provenance),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

async function loadConsultationById(params: {
  userId: string;
  consultationId: string;
}): Promise<Meeting | null> {
  const { consultationId, userId } = params;
  return getMeetingForUser(consultationId, userId);
}

async function loadRoundContext(params: {
  userId: string;
  roundId: string;
}): Promise<ConsultationContext | null> {
  const { roundId, userId } = params;
  return getConsultationForUser(roundId, userId);
}

async function loadRejectedAuditEvents(params: {
  userId: string;
  consultationIds: string[];
}): Promise<AuditLogEntry[]> {
  const { userId, consultationIds } = params;

  if (consultationIds.length === 0) {
    return [];
  }

  return listAuditEventsForUser(userId, {
    action: "theme.rejected",
    consultationIds,
  });
}

async function loadRoundSummaryInternal(params: {
  userId: string;
  round: ConsultationContext;
}): Promise<RoundSummaryData> {
  const { userId, round } = params;
  const consultations = (await listMeetingsForConsultation(round.id, userId)).map(
    (consultation) => ({
      id: consultation.id,
      title: consultation.title,
      consultation_id: consultation.consultation_id,
    })
  ) as MeetingContext[];
  const consultationIds = consultations.map((consultation) => consultation.id);
  const consultationById = new Map(
    consultations.map((consultation) => [consultation.id, consultation])
  );

  const acceptedThemes =
    consultationIds.length > 0
      ? await listInsightsForMeetings(consultationIds, userId, {
          accepted: true,
        })
      : [];

  const rejectedEvents = await loadRejectedAuditEvents({
    userId,
    consultationIds,
  });

  const roundById = new Map([[round.id, round]]);
  const rejectedThemes = rejectedEvents
    .map((event) =>
      buildRejectedThemeReference({
        event,
        consultationById,
        roundById,
      })
    )
    .filter((value): value is ReportThemeReference => value !== null);

  return {
    roundId: round.id,
    roundLabel: round.label,
    roundDescription: round.description ?? null,
    linkedConsultationCount: consultations.length,
    acceptedThemes: collateRoundAcceptedThemes({
      themes: acceptedThemes,
      consultationById,
      round,
    }),
    rejectedThemes,
  };
}

export async function getRoundSummaryData(
  roundId: string
): Promise<RoundSummaryData | null> {
  const userId = await requireCurrentUserId();
  const round = await loadRoundContext({ userId, roundId });

  if (!round) {
    return null;
  }

  return loadRoundSummaryInternal({
    userId,
    round,
  });
}

// ─── Report artifact listing and loading ─────────────────────────────────────

export interface ReportArtifactListItem {
  id: string;
  artifactType: "summary" | "report" | "email";
  title: string | null;
  contentPreview: string;
  roundId: string;
  roundLabel: string;
  generatedAt: string;
  updatedAt: string;
}

export interface ConsultationMeta {
  id: string;
  title: string;
  date: string;
  people: string[];
}

export interface AuditSummaryEvent {
  action: string;
  createdAt: string;
  entityType: string | null;
}

export interface ReportArtifactDetail {
  id: string;
  artifactType: "summary" | "report" | "email";
  title: string | null;
  content: string;
  roundId: string;
  roundLabel: string;
  roundDescription: string | null;
  generatedAt: string;
  updatedAt: string;
  inputSnapshot: ReportInputSnapshot;
  consultationTitles: string[];
  consultations: ConsultationMeta[];
  acceptedThemeCount: number;
  supportingThemeCount: number;
  versionNumber: number;
  totalVersions: number;
  auditSummary: AuditSummaryEvent[];
  draftThemeGroups: Array<{ id: string; label: string; description: string | null }>;
}

function previewContent(content: string, maxLength = 200): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.slice(0, maxLength).trimEnd() + "…";
}

export async function getReportArtifacts(): Promise<ReportArtifactListItem[]> {
  const userId = await requireCurrentUserId();
  const artifacts = await listRoundOutputArtifactsForUser(userId);

  if (artifacts.length === 0) {
    return [];
  }

  // Dedupe to latest per (round_id, artifact_type)
  const seen = new Set<string>();
  const latestArtifacts: typeof artifacts = [];

  for (const artifact of artifacts) {
    const key = `${artifact.consultation_id}:${artifact.artifact_type}`;
    if (!seen.has(key)) {
      seen.add(key);
      latestArtifacts.push(artifact);
    }
  }

  // Load round labels
  const roundIds = Array.from(new Set(latestArtifacts.map((a) => a.consultation_id)));
  const rounds = await listConsultationsByIdsForUser(roundIds, userId);

  const roundLabelById = new Map(
    rounds.map((round) => [round.id, round.label])
  );

  return latestArtifacts.map((artifact) => ({
    id: artifact.id,
    artifactType: artifact.artifact_type as "summary" | "report" | "email",
    title: artifact.title ?? null,
    contentPreview: previewContent(artifact.content),
    roundId: artifact.consultation_id,
    roundLabel: roundLabelById.get(artifact.consultation_id) ?? "Unknown round",
    generatedAt: artifact.generated_at,
    updatedAt: artifact.updated_at,
  }));
}

export async function getReportArtifact(
  artifactId: string
): Promise<ReportArtifactDetail | null> {
  const userId = await requireCurrentUserId();
  const artifact = await getRoundOutputArtifactForUser(artifactId, userId);

  if (!artifact) {
    return null;
  }

  // Load round context
  const round = await getConsultationForUser(artifact.consultation_id, userId);
  const versions = await listRoundOutputArtifactsForRound(
    artifact.consultation_id,
    userId,
    artifact.artifact_type
  );
  const ascendingVersions = [...versions].sort((left, right) =>
    left.generated_at.localeCompare(right.generated_at)
  );
  const versionNumber = Math.max(
    1,
    ascendingVersions.findIndex((candidate) => candidate.id === artifact.id) + 1
  );

  const inputSnapshot = toReportInputSnapshot(artifact.input_snapshot ?? {});
  const graphModel = buildReportGraphModel(inputSnapshot);
  const consultationTitles = getMeetingTitles(inputSnapshot);
  const acceptedThemes = getAcceptedConsultationThemes(inputSnapshot);
  const supportingThemes = getSupportingMeetingThemes(inputSnapshot);
  const acceptedThemeCount = graphModel
    ? graphModel.acceptedThemeCount
    : acceptedThemes.length;
  const supportingThemeCount = graphModel
    ? graphModel.supportingThemeCount
    : supportingThemes.length;

  // Load live consultation metadata (dates + linked people) for compliance display
  const liveConsultations = await listMeetingsForConsultation(artifact.consultation_id, userId);
  const liveConsultationIds = liveConsultations.map((c) => c.id);

  const consultationPeople = await Promise.all(
    liveConsultations.map(async (consultation) => ({
      consultationId: consultation.id,
      people: await listPeopleForMeeting(consultation.id, userId),
    }))
  );
  const peopleByConsultationId = new Map(
    consultationPeople.map(({ consultationId, people }) => [
      consultationId,
      people.map((person) => person.name),
    ])
  );

  const consultations: ConsultationMeta[] = liveConsultations.map((c) => ({
    id: c.id,
    title: c.title,
    date: c.created_at,
    people: peopleByConsultationId.get(c.id) ?? [],
  }));

  // Load draft (unapproved) theme groups for the round
  const draftThemeGroups = (
    await listDraftThemesForRound(artifact.consultation_id, userId)
  ).map((group) => ({
    id: group.id,
    label: group.label,
    description: group.description,
  }));

  // Load key audit events for the report's compliance trail section
  const auditSummary: AuditSummaryEvent[] =
    liveConsultationIds.length > 0
      ? (await listAuditEventsForUser(userId, { consultationIds: liveConsultationIds }))
          .slice(0, 100)
          .map((event) => ({
            action: event.action,
            createdAt: event.created_at,
            entityType: event.entity_type ?? null,
          }))
      : [];

  return {
    id: artifact.id,
    artifactType: artifact.artifact_type as "summary" | "report" | "email",
    title: artifact.title ?? null,
    content: artifact.content,
    roundId: artifact.consultation_id,
    roundLabel: round?.label ?? "Unknown round",
    roundDescription: round?.description ?? null,
    generatedAt: artifact.generated_at,
    updatedAt: artifact.updated_at,
    inputSnapshot,
    consultationTitles,
    consultations,
    acceptedThemeCount,
    supportingThemeCount,
    versionNumber,
    totalVersions: versions.length || 1,
    auditSummary,
    draftThemeGroups,
  };
}

export async function getReportArtifactVersions(
  roundId: string,
  artifactType: string
): Promise<ReportArtifactListItem[]> {
  const userId = await requireCurrentUserId();
  const [artifacts, round] = await Promise.all([
    listRoundOutputArtifactsForRound(roundId, userId, artifactType),
    getConsultationForUser(roundId, userId),
  ]);

  const roundLabel = round?.label ?? "Unknown round";

  return artifacts.map((artifact) => ({
    id: artifact.id,
    artifactType: artifact.artifact_type as "summary" | "report" | "email",
    title: artifact.title ?? null,
    contentPreview: previewContent(artifact.content),
    roundId: artifact.consultation_id,
    roundLabel,
    generatedAt: artifact.generated_at,
    updatedAt: artifact.updated_at,
  }));
}

export async function getMeetingReportData(
  meetingId: string
): Promise<ConsultationReportData | null> {
  const userId = await requireCurrentUserId();
  const consultation = await loadConsultationById({ consultationId: meetingId, userId });

  if (!consultation) {
    return null;
  }

  const meetingContext: MeetingContext = {
    id: consultation.id,
    title: consultation.title,
    consultation_id: consultation.consultation_id,
  };

  let localAcceptedThemes: Insight[] = [];
  try {
    localAcceptedThemes = await listInsightsForMeeting(meetingId, userId, {
      accepted: true,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(
      `[meeting-report] failed to load accepted themes for ${meetingId}: ${detail}`
    );
  }
  const round = consultation.consultation_id
    ? await loadRoundContext({ userId, roundId: consultation.consultation_id })
    : null;

  const consultationThemes = localAcceptedThemes
    .map((theme) =>
      buildAcceptedConsultationThemeReference({
        theme,
        consultation: meetingContext,
        round,
      })
    )
    .sort((left, right) => left.label.localeCompare(right.label));

  if (!round) {
    const rejectedEvents = await loadRejectedAuditEvents({
      userId,
      consultationIds: [meetingId],
    });

    const consultationById = new Map([[consultation.id, meetingContext]]);
    const rejectedThemes = rejectedEvents
      .map((event) =>
        buildRejectedThemeReference({
          event,
          consultationById,
          roundById: new Map(),
        })
      )
      .filter((value): value is ReportThemeReference => value !== null);

    return {
      consultationId: consultation.id,
      consultationTitle: consultation.title,
      roundId: null,
      roundLabel: null,
      consultationThemes,
      roundThemes: [],
      rejectedThemes,
      includedThemes: buildIncludedThemes(consultationThemes, []),
      roundSummary: null,
    };
  }

  const roundSummary = await loadRoundSummaryInternal({
    userId,
    round,
  });

  const roundThemes = roundSummary.acceptedThemes
    .map((theme) => ({
      ...theme,
      provenance: theme.provenance.filter(
        (entry) => entry.consultationId !== consultation.id
      ),
    }))
    .filter((theme) => theme.provenance.length > 0);

  const rejectedThemes = roundSummary.rejectedThemes;

  return {
    consultationId: consultation.id,
    consultationTitle: consultation.title,
    roundId: round.id,
    roundLabel: round.label,
    consultationThemes,
    roundThemes,
    rejectedThemes,
    includedThemes: buildIncludedThemes(consultationThemes, roundThemes),
    roundSummary,
  };
}

export const getConsultationReportData = getMeetingReportData;

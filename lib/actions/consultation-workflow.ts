"use server";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLog,
  consultationGroupMembers,
  meetingGroups as consultationGroups,
  meetings as consultationRounds,
  consultations,
  evidenceEmails,
  insights,
  consultationDecisions as roundDecisions,
  consultationOutputArtifacts as roundOutputArtifacts,
  themeMembers,
  themes,
} from "@/db/schema";
import { callAIService } from "@/lib/openai/client";
import { getActiveReportTemplate } from "@/lib/actions/report-templates";
import { AUDIT_ACTIONS } from "@/lib/actions/audit-actions";
import { emitAuditEvent } from "@/lib/actions/audit";
import { getServerSession } from "@/lib/auth/session";
import {
  mapAuditLogRecord,
  mapConsultationRecord,
  mapConsultationRoundRecord,
  mapEvidenceEmailRecord,
  mapInsightRecord,
  mapRoundOutputArtifactRecord,
} from "@/lib/data/mappers";
import {
  buildLegacyReportGraphSnapshot,
  type ReportInputSnapshot,
} from "@/lib/report-graph";
import {
  loadRoundAnalyticsSummary,
  type RoundAnalyticsSummary,
} from "@/lib/data/analytics-read";
import type {
  Consultation,
  ConsultationRound,
  EvidenceEmail,
  Insight,
  RoundDecision,
  RoundDecisionTargetType,
  RoundDecisionType,
  RoundOutputArtifact,
  RoundOutputArtifactType,
  Theme,
  ThemeMember,
} from "@/types/db";

export type { RoundAnalyticsSummary } from "@/lib/data/analytics-read";

type ThemeRow = typeof themes.$inferSelect;
type ThemeMemberRow = typeof themeMembers.$inferSelect;
type RoundDecisionRow = typeof roundDecisions.$inferSelect;

type RoundTargetStatus =
  | "unreviewed"
  | "accepted"
  | "discarded"
  | "management_rejected";

interface LatestEvidenceEmailSummary {
  id: string;
  consultationId: string;
  status: EvidenceEmail["status"];
  subject: string | null;
  generatedAt: string | null;
  acceptedAt: string | null;
  sentAt: string | null;
  previewText: string | null;
  href: string;
}

export interface RoundDetailConsultation {
  id: string;
  title: string;
  status: ConsultationRound["status"];
  evidenceEmail: LatestEvidenceEmailSummary | null;
  hasLockedEvidence: boolean;
}

export interface RoundSourceTheme {
  sourceThemeId: string;
  consultationId: string;
  consultationTitle: string;
  label: string;
  description: string | null;
  editableLabel: string;
  editableDescription: string | null;
  acceptedState: "accepted" | "rejected";
  lockedFromSource: boolean;
  isGrouped: boolean;
  isUserAdded: boolean;
  roundDecisionStatus: RoundTargetStatus;
  effectiveIncluded: boolean;
  groupId: string | null;
  groupLabel: string | null;
  createdAt: string;
}

export interface ThemeMemberDetail {
  id: string;
  insightId: string;
  sourceConsultationId: string;
  sourceConsultationTitle: string;
  label: string;
  description: string | null;
  lockedFromSource: boolean;
  isUserAdded: boolean;
  position: number;
}

export interface ThemeDraftState {
  draftLabel: string;
  draftDescription: string;
  draftExplanation: string | null;
  createdAt: string | null;
  createdBy: string | null;
}

export interface ThemeDetail {
  id: string;
  label: string;
  description: string | null;
  status: Theme["status"];
  origin: Theme["origin"];
  currentGroup: {
    label: string;
    description: string | null;
    origin: Theme["origin"];
    status: Theme["status"];
  };
  pendingDraft: ThemeDraftState | null;
  members: ThemeMemberDetail[];
  memberCount: number;
  lastStructuralChangeAt: string;
  lastStructuralChangeBy: string | null;
  createdAt: string;
  updatedAt: string;
  actorId: string;
}

export interface RoundDecisionHistoryItem {
  id: string;
  targetType: RoundDecisionTargetType;
  targetId: string;
  targetLabel: string | null;
  decisionType: RoundDecisionType;
  rationale: string | null;
  actor: string;
  timestamp: string;
  metadata: Record<string, unknown> | null;
}

export interface RoundOutputSummary {
  id: string;
  artifactType: RoundOutputArtifactType;
  status: RoundOutputArtifact["status"];
  title: string | null;
  content: string;
  contentPreview: string;
  generatedAt: string;
  updatedAt: string;
  inputSnapshot: ReportInputSnapshot;
}

export interface RoundHistoryEvent {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actor: string;
  createdAt: string;
  consultationId: string | null;
  payload: Record<string, unknown> | null;
}

export interface RoundOutputCollection {
  summary: RoundOutputSummary | null;
  report: RoundOutputSummary | null;
  email: RoundOutputSummary | null;
}

export interface ConsultationGroupMemberDetail {
  id: string;
  consultationId: string;
  consultationTitle: string;
  consultationStatus: string;
  position: number;
}

export interface ConsultationGroupDetail {
  id: string;
  label: string;
  position: number;
  members: ConsultationGroupMemberDetail[];
  memberCount: number;
}

export interface RoundDetail {
  round: {
    id: string;
    label: string;
    description: string | null;
    linkedConsultationCount: number;
  };
  consultations: RoundDetailConsultation[];
  sourceThemes: RoundSourceTheme[];
  themeGroups: ThemeDetail[];
  consultationGroups: ConsultationGroupDetail[];
  decisionHistory: RoundDecisionHistoryItem[];
  outputs: RoundOutputCollection;
  history: RoundHistoryEvent[];
  analytics: RoundAnalyticsSummary;
}

interface InsightWithConsultation extends Insight {
  consultation: ConsultationRound;
}

interface StructuralDraftResponse {
  draft_label?: string;
  draft_description?: string;
  explanation?: string | null;
}

interface ConsultationGroupRecord {
  id: string;
  label: string;
  position: number;
}

interface ConsultationGroupMemberRecord {
  id: string;
  group_id: string;
  consultation_id: string;
  position: number;
}

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function trimToNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function previewText(value: string | null | undefined, max = 180) {
  const clean = trimToNull(value);

  if (!clean) {
    return null;
  }

  if (clean.length <= max) {
    return clean;
  }

  return `${clean.slice(0, max - 1)}…`;
}

function isEvidenceLocked(status: EvidenceEmail["status"]) {
  return status === "accepted" || status === "sent";
}

function buildLatestEvidenceEmailSummary(
  consultationId: string,
  emails: EvidenceEmail[]
): LatestEvidenceEmailSummary | null {
  const latest = emails[0];

  if (!latest) {
    return null;
  }

  return {
    id: latest.id,
    consultationId,
    status: latest.status,
    subject: latest.subject ?? null,
    generatedAt: latest.generated_at ?? null,
    acceptedAt: latest.accepted_at ?? null,
    sentAt: latest.sent_at ?? null,
    previewText: previewText(latest.body_final ?? latest.body_draft),
    href: `/consultations/${consultationId}#evidence-email`,
  };
}

function buildFallbackDraft(params: {
  structuralChange: string;
  memberThemes: Array<{
    label: string;
    description: string | null;
  }>;
}) {
  const { structuralChange, memberThemes } = params;
  const cleanLabels = memberThemes
    .map((theme) => trimToNull(theme.label))
    .filter((value): value is string => Boolean(value));
  const label =
    cleanLabels.length === 0
      ? "Theme group"
      : cleanLabels.length === 1
        ? cleanLabels[0]
        : cleanLabels.slice(0, 2).join(" + ");
  const description =
    memberThemes
      .map((theme) => trimToNull(theme.description))
      .filter((value): value is string => Boolean(value))[0] ??
    `Draft refinement created after a ${structuralChange.replaceAll("_", " ")} action.`;

  return {
    draftLabel: label,
    draftDescription: description,
    draftExplanation:
      "Fallback draft created locally because the AI refinement service was unavailable.",
  };
}

function buildFallbackOutput(params: {
  artifactType: RoundOutputArtifactType;
  roundLabel: string;
  roundDescription: string | null;
  consultationTitles: string[];
  acceptedRoundThemes: Array<{ label: string; description: string | null }>;
  supportingThemes: Array<{
    label: string;
    description: string | null;
    consultationTitle: string | null;
  }>;
}) {
  const {
    artifactType,
    roundLabel,
    roundDescription,
    consultationTitles,
    acceptedRoundThemes,
    supportingThemes,
  } = params;

  const header =
    artifactType === "email"
      ? `Consultation evidence update: ${roundLabel}`
      : artifactType === "report"
        ? `${roundLabel} consultation report`
        : `${roundLabel} consultation summary`;

  const roundThemeLines =
    acceptedRoundThemes.length > 0
      ? acceptedRoundThemes.map((theme) => `- ${theme.label}: ${theme.description ?? "Accepted consultation theme."}`)
      : ["- No accepted consultation themes are available yet."];

  const supportingLines =
    supportingThemes.length > 0
      ? supportingThemes.map(
          (theme) =>
            `- ${theme.label}${theme.consultationTitle ? ` (${theme.consultationTitle})` : ""}: ${theme.description ?? "Supporting meeting theme."}`
        )
      : ["- No supporting meeting themes are available yet."];

  const content = [
    artifactType === "email"
      ? `Subject: ${header}`
      : header,
    "",
    roundDescription ? `Consultation description: ${roundDescription}` : null,
    consultationTitles.length > 0
      ? `Linked meetings: ${consultationTitles.join(", ")}`
      : "Linked meetings: none recorded",
    "",
    "Accepted consultation themes:",
    ...roundThemeLines,
    "",
    "Supporting meeting themes:",
    ...supportingLines,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return {
    title: header,
    content,
  };
}

async function requireAuthenticatedContext() {
  const session = await getServerSession();

  if (!session) {
    throw new Error("Not authenticated");
  }

  return { userId: session.user.id };
}

function mapThemeRecord(row: ThemeRow): Theme {
  return {
    id: row.id,
    consultation_id: row.consultationId,
    meeting_id: row.consultationId,
    user_id: row.userId,
    label: row.label,
    description: row.description,
    status: row.status as Theme["status"],
    origin: row.origin as Theme["origin"],
    ai_draft_label: row.aiDraftLabel,
    ai_draft_description: row.aiDraftDescription,
    ai_draft_explanation: row.aiDraftExplanation,
    ai_draft_created_at: toIsoString(row.aiDraftCreatedAt),
    ai_draft_created_by: row.aiDraftCreatedBy,
    last_structural_change_at: row.lastStructuralChangeAt.toISOString(),
    last_structural_change_by: row.lastStructuralChangeBy,
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function mapThemeMemberRecord(
  row: ThemeMemberRow
): ThemeMember {
  return {
    id: row.id,
    theme_id: row.themeId,
    consultation_id: row.consultationId,
    insight_id: row.insightId,
    source_meeting_id: row.sourceMeetingId,
    user_id: row.userId,
    position: row.position,
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
  };
}

function mapRoundDecisionRecord(row: RoundDecisionRow): RoundDecision {
  return {
    id: row.id,
    consultation_id: row.consultationId,
    user_id: row.userId,
    target_type: row.targetType as RoundDecision["target_type"],
    target_id: row.targetId,
    decision_type: row.decisionType as RoundDecision["decision_type"],
    rationale: row.rationale,
    metadata: row.metadata,
    created_at: row.createdAt.toISOString(),
  };
}

async function loadOwnedRound(params: { userId: string; roundId: string }) {
  const { userId, roundId } = params;
  const [row] = await db
    .select()
    .from(consultations)
    .where(
      and(
        eq(consultations.id, roundId),
        eq(consultations.userId, userId)
      )
    )
    .limit(1);

  if (!row) {
    throw new Error("Consultation not found");
  }

  const consultation = mapConsultationRecord(row);

  return {
    ...consultation,
    title: consultation.label,
    transcript_raw: consultation.description,
  };
}

async function loadRoundConsultations(params: { userId: string; roundId: string }) {
  const { userId, roundId } = params;
  const rows = await db
    .select()
    .from(consultationRounds)
    .where(
      and(
        eq(consultationRounds.consultationId, roundId),
        eq(consultationRounds.userId, userId)
      )
    )
    .orderBy(asc(consultationRounds.createdAt));

  return rows.map(mapConsultationRoundRecord);
}

async function loadAcceptedInsights(params: { consultationIds: string[] }) {
  const { consultationIds } = params;

  if (consultationIds.length === 0) {
    return [] as Insight[];
  }

  const rows = await db
    .select()
    .from(insights)
    .where(
      and(
        eq(insights.accepted, true),
        inArray(insights.meetingId, consultationIds)
      )
    )
    .orderBy(asc(insights.createdAt));

  return rows.map(mapInsightRecord);
}

async function loadRoundGroups(params: { roundId: string }) {
  const { roundId } = params;
  const rows = await db
    .select()
    .from(themes)
    .where(eq(themes.consultationId, roundId))
    .orderBy(asc(themes.createdAt));

  return rows.map(mapThemeRecord);
}

async function loadRoundGroupMembers(params: { roundId: string }) {
  const { roundId } = params;
  const rows = await db
    .select()
    .from(themeMembers)
    .where(eq(themeMembers.consultationId, roundId))
    .orderBy(
      asc(themeMembers.position),
      asc(themeMembers.createdAt)
    );

  return rows.map(mapThemeMemberRecord);
}

async function loadConsultationGroups(params: { roundId: string }) {
  const { roundId } = params;
  const rows = await db
    .select()
    .from(consultationGroups)
    .where(eq(consultationGroups.consultationId, roundId))
    .orderBy(asc(consultationGroups.position), asc(consultationGroups.createdAt));

  return rows.map(
    (row): ConsultationGroupRecord => ({
      id: row.id,
      label: row.label,
      position: row.position,
    })
  );
}

async function loadConsultationGroupMembers(params: { roundId: string }) {
  const { roundId } = params;
  const rows = await db
    .select()
    .from(consultationGroupMembers)
    .where(eq(consultationGroupMembers.consultationId, roundId))
    .orderBy(
      asc(consultationGroupMembers.position),
      asc(consultationGroupMembers.createdAt)
    );

  return rows.map(
    (row): ConsultationGroupMemberRecord => ({
      id: row.id,
      group_id: row.groupId,
      consultation_id: row.meetingId,
      position: row.position,
    })
  );
}

async function loadRoundDecisions(params: { roundId: string }) {
  const { roundId } = params;
  const rows = await db
    .select()
    .from(roundDecisions)
    .where(eq(roundDecisions.consultationId, roundId))
    .orderBy(desc(roundDecisions.createdAt));

  return rows.map(mapRoundDecisionRecord);
}

async function loadRoundOutputs(params: { roundId: string }) {
  const { roundId } = params;
  const rows = await db
    .select()
    .from(roundOutputArtifacts)
    .where(eq(roundOutputArtifacts.consultationId, roundId))
    .orderBy(desc(roundOutputArtifacts.generatedAt));

  return rows.map(mapRoundOutputArtifactRecord);
}

async function loadEvidenceEmailsByConsultation(params: {
  consultationIds: string[];
}) {
  const { consultationIds } = params;

  if (consultationIds.length === 0) {
    return new Map<string, EvidenceEmail[]>();
  }

  const rows = await db
    .select()
    .from(evidenceEmails)
    .where(inArray(evidenceEmails.meetingId, consultationIds))
    .orderBy(desc(evidenceEmails.createdAt));

  const emails = rows.map(mapEvidenceEmailRecord);
  const grouped = new Map<string, EvidenceEmail[]>();

  emails.forEach((email) => {
    const bucket = grouped.get(email.meeting_id) ?? [];
    bucket.push(email);
    grouped.set(email.meeting_id, bucket);
  });

  return grouped;
}

async function loadRoundHistory(params: {
  userId: string;
  roundId: string;
  consultationIds: string[];
}) {
  const { userId, roundId, consultationIds } = params;
  const rows = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.userId, userId))
    .orderBy(desc(auditLog.createdAt))
    .limit(400);

  const consultationIdSet = new Set(consultationIds);

  return rows
    .map(mapAuditLogRecord)
    .filter((entry) => {
      if (entry.meeting_id && consultationIdSet.has(entry.meeting_id)) {
        return true;
      }

      if (entry.entity_id === roundId) {
        return true;
      }

      const payloadRoundId =
        trimToNull(entry.payload?.consultation_id) ?? trimToNull(entry.payload?.round_id);
      return payloadRoundId === roundId;
    })
    .map(
      (entry): RoundHistoryEvent => ({
        id: entry.id,
        action: entry.action,
        entityType: entry.entity_type,
        entityId: entry.entity_id,
        actor: entry.user_id,
        createdAt: entry.created_at,
        consultationId: entry.meeting_id,
        payload: entry.payload ?? null,
      })
    );
}

function latestDecisionByTarget(decisions: RoundDecision[]) {
  const latest = new Map<string, RoundDecision>();

  for (const decision of decisions) {
    const key = `${decision.target_type}:${decision.target_id}`;
    if (!latest.has(key)) {
      latest.set(key, decision);
    }
  }

  return latest;
}

function buildOutputCollection(outputs: RoundOutputArtifact[]): RoundOutputCollection {
  const latestByType = new Map<RoundOutputArtifactType, RoundOutputArtifact>();

  for (const output of outputs) {
    if (!latestByType.has(output.artifact_type)) {
      latestByType.set(output.artifact_type, output);
    }
  }

  const build = (artifactType: RoundOutputArtifactType): RoundOutputSummary | null => {
    const output = latestByType.get(artifactType);

    if (!output) {
      return null;
    }

    return {
      id: output.id,
      artifactType,
      status: output.status,
      title: output.title ?? null,
      content: output.content,
      contentPreview: previewText(output.content, 260) ?? "",
      generatedAt: output.generated_at,
      updatedAt: output.updated_at,
      inputSnapshot: output.input_snapshot,
    };
  };

  return {
    summary: build("summary"),
    report: build("report"),
    email: build("email"),
  };
}

async function loadInsightsForRound(params: {
  userId: string;
  roundId: string;
  themeIds: string[];
}) {
  const { userId, roundId, themeIds } = params;

  if (themeIds.length === 0) {
    return [] as InsightWithConsultation[];
  }

  const rows = await db
    .select({
      insight: insights,
      consultation: consultationRounds,
    })
    .from(insights)
    .innerJoin(consultationRounds, eq(insights.meetingId, consultationRounds.id))
    .where(
      and(
        inArray(insights.id, themeIds),
        eq(consultationRounds.userId, userId),
        eq(consultationRounds.consultationId, roundId)
      )
    )
    .orderBy(asc(insights.createdAt));

  return rows.map(
    ({ insight, consultation }): InsightWithConsultation => ({
      ...mapInsightRecord(insight),
      consultation: mapConsultationRoundRecord(consultation),
    })
  );
}

async function loadGroupForRound(params: {
  userId: string;
  roundId: string;
  groupId: string;
}) {
  const { userId, roundId, groupId } = params;
  const [row] = await db
    .select()
    .from(themes)
    .where(
      and(
        eq(themes.id, groupId),
        eq(themes.consultationId, roundId),
        eq(themes.userId, userId)
      )
    )
    .limit(1);

  if (!row) {
    throw new Error("Round theme group not found");
  }

  return mapThemeRecord(row);
}

async function loadGroupMembers(params: { groupId: string }) {
  const { groupId } = params;
  const rows = await db
    .select()
    .from(themeMembers)
    .where(eq(themeMembers.themeId, groupId))
    .orderBy(
      asc(themeMembers.position),
      asc(themeMembers.createdAt)
    );

  return rows.map(mapThemeMemberRecord);
}

async function writeGroupDraftSuggestion(params: {
  group: Theme;
  round: ConsultationRound;
  memberThemes: InsightWithConsultation[];
  userId: string;
  structuralChange: string;
}) {
  const { group, round, memberThemes, userId, structuralChange } = params;
  const timestamp = new Date();

  if (memberThemes.length === 0) {
    await db
      .update(themes)
      .set({
        aiDraftLabel: null,
        aiDraftDescription: null,
        aiDraftExplanation: null,
        aiDraftCreatedAt: null,
        aiDraftCreatedBy: null,
        lastStructuralChangeAt: timestamp,
        lastStructuralChangeBy: userId,
        updatedAt: timestamp,
      })
      .where(eq(themes.id, group.id));

    return null;
  }

  const fallback = buildFallbackDraft({
    structuralChange,
    memberThemes,
  });

  let draft = fallback;

  try {
    const response = (await callAIService("/rounds/refine-group-draft", {
      round_label: round.title,
      current_label: group.label,
      current_description: group.description,
      structural_change: structuralChange,
      member_themes: memberThemes.map((theme) => ({
        label: theme.label,
        description: theme.description,
        consultation_title: theme.consultation.title,
        is_user_added: theme.is_user_added,
        locked_from_source: false,
      })),
    })) as StructuralDraftResponse;

    draft = {
      draftLabel: trimToNull(response.draft_label) ?? fallback.draftLabel,
      draftDescription:
        trimToNull(response.draft_description) ?? fallback.draftDescription,
      draftExplanation: trimToNull(response.explanation) ?? fallback.draftExplanation,
    };
  } catch {
    draft = fallback;
  }

  await db
    .update(themes)
    .set({
      aiDraftLabel: draft.draftLabel,
      aiDraftDescription: draft.draftDescription,
      aiDraftExplanation: draft.draftExplanation,
      aiDraftCreatedAt: timestamp,
      aiDraftCreatedBy: userId,
      lastStructuralChangeAt: timestamp,
      lastStructuralChangeBy: userId,
      updatedAt: timestamp,
    })
    .where(eq(themes.id, group.id));

  await emitAuditEvent({
    action: AUDIT_ACTIONS.ROUND_THEME_GROUP_DRAFT_CREATED,
    entityType: "round_theme_group",
    entityId: group.id,
    metadata: {
      round_id: round.id,
      structural_change: structuralChange,
      draft_label: draft.draftLabel,
      member_theme_ids: memberThemes.map((theme) => theme.id),
    },
  });

  return draft;
}

async function maybeDiscardEmptyGroup(params: { group: Theme }) {
  const { group } = params;
  const members = await loadGroupMembers({ groupId: group.id });

  if (members.length > 0) {
    return false;
  }

  await db
    .update(themes)
    .set({
      status: "discarded",
      aiDraftLabel: null,
      aiDraftDescription: null,
      aiDraftExplanation: null,
      aiDraftCreatedAt: null,
      aiDraftCreatedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(themes.id, group.id));

  return true;
}

async function insertRoundDecision(params: {
  roundId: string;
  userId: string;
  targetType: RoundDecisionTargetType;
  targetId: string;
  decisionType: RoundDecisionType;
  rationale?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const {
    roundId,
    userId,
    targetType,
    targetId,
    decisionType,
    rationale,
    metadata,
  } = params;

  await db.insert(roundDecisions).values({
    consultationId: roundId,
    userId,
    targetType,
    targetId,
    decisionType,
    rationale: trimToNull(rationale),
    metadata: metadata ?? null,
  });
}

function mapTargetStatus(decision: RoundDecision | undefined): RoundTargetStatus {
  if (!decision) {
    return "unreviewed";
  }

  return decision.decision_type;
}

export async function getRoundDetail(roundId: string): Promise<RoundDetail | null> {
  console.log("[getRoundDetail] start", { roundId });

  const { userId } = await requireAuthenticatedContext();
  console.log("[getRoundDetail] authenticated", { userId });

  const round = await loadOwnedRound({ userId, roundId });
  console.log("[getRoundDetail] round loaded", { roundId: round.id });

  const consultations = await loadRoundConsultations({ userId, roundId });
  const consultationIds = consultations.map((consultation) => consultation.id);
  console.log("[getRoundDetail] consultations loaded", { count: consultationIds.length });

  let analytics: RoundAnalyticsSummary;
  try {
    analytics = await loadRoundAnalyticsSummary({
      consultationId: roundId,
      meetingIds: consultationIds,
    });
    console.log("[getRoundDetail] analytics loaded ok");
  } catch (analyticsError) {
    console.error("[getRoundDetail] analytics load failed — falling back to empty summary. Run: bun run db:migrate", {
      roundId,
      error: analyticsError instanceof Error ? analyticsError.message : analyticsError,
    });
    analytics = {
      consultationCount: consultationIds.length,
      processedConsultationCount: 0,
      failedConsultationCount: 0,
      activeConsultationCount: 0,
      totalTermCount: 0,
      clusterCount: 0,
      outlierTermCount: 0,
      averageExtractionConfidence: null,
      latestExtractionAt: null,
      latestClusteredAt: null,
      latestJobStatus: null,
      clusters: [],
    };
  }

  console.log("[getRoundDetail] loading remaining data in parallel");
  const [acceptedInsights, groups, members, decisions, outputs, emailMap, history, consultationGroups, consultationGroupMembers] =
    await Promise.all([
      loadAcceptedInsights({ consultationIds }),
      loadRoundGroups({ roundId }),
      loadRoundGroupMembers({ roundId }),
      loadRoundDecisions({ roundId }),
      loadRoundOutputs({ roundId }),
      loadEvidenceEmailsByConsultation({ consultationIds }),
      loadRoundHistory({ userId, roundId, consultationIds }),
      loadConsultationGroups({ roundId }),
      loadConsultationGroupMembers({ roundId }),
    ]);
  console.log("[getRoundDetail] parallel load done");

  const consultationById = new Map(consultations.map((consultation) => [consultation.id, consultation]));
  const latestDecisionMap = latestDecisionByTarget(decisions);
  const memberByInsightId = new Map<string, ThemeMember>();

  members.forEach((member) => {
    memberByInsightId.set(member.insight_id, member);
  });

  // Build a map of consultation_id → consultation group id for quick lookup
  const consultationGroupMemberByConsultationId = new Map<string, { groupId: string; position: number }>();
  consultationGroupMembers.forEach((m) => {
    consultationGroupMemberByConsultationId.set(m.consultation_id, { groupId: m.group_id, position: m.position });
  });

  const consultationItems = consultations.map((consultation): RoundDetailConsultation => {
    const emails = emailMap.get(consultation.id) ?? [];
    const latestEmail = buildLatestEvidenceEmailSummary(consultation.id, emails);

    return {
      id: consultation.id,
      title: consultation.title,
      status: consultation.status,
      evidenceEmail: latestEmail,
      hasLockedEvidence: emails.some((email) => isEvidenceLocked(email.status)),
    };
  });

  const insightById = new Map(acceptedInsights.map((insight) => [insight.id, insight]));
  const sourceThemes = acceptedInsights.map((theme): RoundSourceTheme => {
    const consultation = consultationById.get(theme.meeting_id);
    if (!consultation) {
      throw new Error("Theme consultation mismatch in round detail payload");
    }

    const consultationSummary = consultationItems.find((item) => item.id === consultation.id);
    const member = memberByInsightId.get(theme.id);
    const decision = latestDecisionMap.get(`source_theme:${theme.id}`);

    return {
      sourceThemeId: theme.id,
      consultationId: consultation.id,
      consultationTitle: consultation.title,
      label: theme.label,
      description: theme.description ?? null,
      editableLabel: theme.label,
      editableDescription: theme.description ?? null,
      acceptedState: "accepted",
      lockedFromSource: consultationSummary?.hasLockedEvidence ?? false,
      isGrouped: Boolean(member),
      isUserAdded: theme.is_user_added,
      roundDecisionStatus: mapTargetStatus(decision),
      effectiveIncluded: decision?.decision_type !== "management_rejected",
      groupId: member?.theme_id ?? null,
      groupLabel: member ? groups.find((group) => group.id === member.theme_id)?.label ?? null : null,
      createdAt: theme.created_at,
    };
  });

  const groupDetails = groups.map((group): ThemeDetail => {
    const groupMembers = members
      .filter((member) => member.theme_id === group.id)
      .filter((member) => {
        // Skip members with missing context (orphaned from failed operations)
        const theme = insightById.get(member.insight_id);
        const consultation = consultationById.get(member.source_meeting_id);
        if (!theme || !consultation) {
          console.warn("[getRoundDetail] skipping orphaned theme member", {
            memberId: member.id,
            insightId: member.insight_id,
            consultationId: member.source_meeting_id,
            foundTheme: Boolean(theme),
            foundConsultation: Boolean(consultation),
          });
          return false;
        }
        return true;
      })
      .map((member) => {
        const theme = insightById.get(member.insight_id);
        const consultation = consultationById.get(member.source_meeting_id);
        const consultationSummary = consultation
          ? consultationItems.find((item) => item.id === consultation.id)
          : null;

        // Safe to assert now after filter above
        if (!theme || !consultation) {
          throw new Error("Assertion failed: theme or consultation missing after filter");
        }

        return {
          id: member.id,
          insightId: theme.id,
          sourceConsultationId: consultation.id,
          sourceConsultationTitle: consultation.title,
          label: theme.label,
          description: theme.description ?? null,
          lockedFromSource: consultationSummary?.hasLockedEvidence ?? false,
          isUserAdded: theme.is_user_added,
          position: member.position,
        } satisfies ThemeMemberDetail;
      });

    return {
      id: group.id,
      label: group.label,
      description: group.description ?? null,
      status: group.status,
      origin: group.origin,
      currentGroup: {
        label: group.label,
        description: group.description ?? null,
        origin: group.origin,
        status: group.status,
      },
      pendingDraft:
        trimToNull(group.ai_draft_label) || trimToNull(group.ai_draft_description)
          ? {
              draftLabel: trimToNull(group.ai_draft_label) ?? group.label,
              draftDescription:
                trimToNull(group.ai_draft_description) ?? group.description ?? "",
              draftExplanation: trimToNull(group.ai_draft_explanation),
              createdAt: group.ai_draft_created_at,
              createdBy: group.ai_draft_created_by,
            }
          : null,
      members: groupMembers,
      memberCount: groupMembers.length,
      lastStructuralChangeAt: group.last_structural_change_at,
      lastStructuralChangeBy: group.last_structural_change_by,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
      actorId: group.created_by,
    };
  });

  // Build consultation group details
  const consultationGroupDetails: ConsultationGroupDetail[] = consultationGroups.map((cg) => {
    const cgMembers = consultationGroupMembers
      .filter((m) => m.group_id === cg.id)
      .map((m): ConsultationGroupMemberDetail => {
        const consultation = consultationById.get(m.consultation_id);
        return {
          id: m.id,
          consultationId: m.consultation_id,
          consultationTitle: consultation?.title ?? "Unknown",
          consultationStatus: consultation?.status ?? "draft",
          position: m.position,
        };
      });

    return {
      id: cg.id,
      label: cg.label,
      position: cg.position,
      members: cgMembers,
      memberCount: cgMembers.length,
    };
  });

  return {
    round: {
      id: round.id,
      label: round.title,
      description: round.transcript_raw ?? null,
      linkedConsultationCount: consultations.length,
    },
    consultations: consultationItems,
    sourceThemes,
    themeGroups: groupDetails,
    consultationGroups: consultationGroupDetails,
    decisionHistory: (() => {
      const groupLabelById = new Map(groupDetails.map((g) => [g.id, g.label]));
      const themeLabelById = new Map(sourceThemes.map((t) => [t.sourceThemeId, t.label]));
      return decisions.map((decision) => ({
        id: decision.id,
        targetType: decision.target_type,
        targetId: decision.target_id,
        targetLabel:
          decision.target_type === "theme_group"
            ? (groupLabelById.get(decision.target_id) ?? null)
            : decision.target_type === "source_theme"
              ? (themeLabelById.get(decision.target_id) ?? null)
              : null,
        decisionType: decision.decision_type,
        rationale: decision.rationale ?? null,
        actor: decision.user_id,
        timestamp: decision.created_at,
        metadata: decision.metadata ?? null,
      }));
    })(),
    outputs: buildOutputCollection(outputs),
    history,
    analytics,
  };
}

export async function createTheme(
  roundId: string,
  seedThemeIds: string[] = []
) {
  const { userId } = await requireAuthenticatedContext();
  const round = await loadOwnedRound({ userId, roundId });
  const seedThemes = await loadInsightsForRound({
    userId,
    roundId,
    themeIds: seedThemeIds,
  });
  const existingMemberships = await loadThemeMembershipsForRound({
    roundId,
    themeIds: seedThemes.map((theme) => theme.id),
  });
  const previousGroupIds = Array.from(
    new Set(existingMemberships.map((membership) => membership.theme_id))
  );

  const defaultLabel =
    seedThemes.length === 1 ? seedThemes[0].label : "Theme group";
  const [created] = await db
    .insert(themes)
    .values({
      consultationId: roundId,
      userId,
      label: defaultLabel,
      description:
        seedThemes.length === 1 ? seedThemes[0].description ?? null : null,
      status: "draft",
      origin: "manual",
      createdBy: userId,
      lastStructuralChangeBy: userId,
    })
    .returning();

  const group = mapThemeRecord(created);

  if (seedThemes.length > 0) {
    await db
      .delete(themeMembers)
      .where(
        and(
          eq(themeMembers.consultationId, roundId),
          inArray(
            themeMembers.themeId,
            seedThemes.map((theme) => theme.id)
          )
        )
      );

    await db.insert(themeMembers).values(
      seedThemes.map((theme, index) => ({
        themeId: group.id,
        consultationId: roundId,
        insightId: theme.id,
        sourceMeetingId: theme.consultation.id,
        userId,
        position: index,
        createdBy: userId,
      }))
    );

    await writeGroupDraftSuggestion({
      group,
      round,
      memberThemes: seedThemes,
      userId,
      structuralChange: "create_group",
    });

    for (const previousGroupId of previousGroupIds) {
      const previousGroup = await loadGroupForRound({
        userId,
        roundId,
        groupId: previousGroupId,
      });
      const discarded = await maybeDiscardEmptyGroup({
        group: previousGroup,
      });

      if (!discarded) {
        await refreshGroupDraftForCurrentMembers({
          userId,
          round,
          groupId: previousGroupId,
          structuralChange: "move_theme_out_of_group",
        });
      }
    }
  }

  await emitAuditEvent({
    action: AUDIT_ACTIONS.ROUND_THEME_GROUP_CREATED,
    entityType: "round_theme_group",
    entityId: group.id,
    metadata: {
      round_id: roundId,
      seed_theme_ids: seedThemeIds,
    },
  });

  return { groupId: group.id };
}

export async function moveThemeToGroup(
  themeId: string,
  targetGroupId: string | null,
  position?: number
) {
  const { userId } = await requireAuthenticatedContext();
  const theme = await loadThemeWithRoundContext({ userId, themeId });
  const roundId = theme.consultation.consultation_id;

  if (!roundId) {
    throw new Error("The source theme is not assigned to a round.");
  }

  const round = await loadOwnedRound({ userId, roundId });
  const currentMembership = await loadThemeMembershipForRound({
    roundId,
    themeId,
  });

  let targetGroup: Theme | null = null;
  if (targetGroupId) {
    targetGroup = await loadGroupForRound({
      userId,
      roundId,
      groupId: targetGroupId,
    });
  }

  const previousGroupId = currentMembership?.theme_id ?? null;

  if (currentMembership && currentMembership.theme_id === targetGroupId) {
    if (typeof position === "number") {
      await db
        .update(themeMembers)
        .set({ position })
        .where(eq(themeMembers.id, currentMembership.id));
    }

    return { groupId: targetGroupId };
  }

  if (currentMembership) {
    await db
      .delete(themeMembers)
      .where(eq(themeMembers.id, currentMembership.id));
  }

  if (targetGroup) {
    const targetMembers = await loadGroupMembers({ groupId: targetGroup.id });
    const nextPosition =
      typeof position === "number" ? position : targetMembers.length;
    await db.insert(themeMembers).values({
      themeId: targetGroup.id,
      consultationId: roundId,
      insightId: theme.id,
      sourceMeetingId: theme.consultation.id,
      userId,
      position: nextPosition,
      createdBy: userId,
    });
  }

  if (previousGroupId) {
    const previousGroup = await loadGroupForRound({
      userId,
      roundId,
      groupId: previousGroupId,
    });
    const discarded = await maybeDiscardEmptyGroup({
      group: previousGroup,
    });

    if (!discarded) {
      await refreshGroupDraftForCurrentMembers({
        userId,
        round,
        groupId: previousGroupId,
        structuralChange: "move_theme_out_of_group",
      });
    }
  }

  if (targetGroup) {
    await refreshGroupDraftForCurrentMembers({
      userId,
      round,
      groupId: targetGroup.id,
      structuralChange: previousGroupId
        ? "move_theme_into_group"
        : "group_existing_theme",
    });
  }

  await emitAuditEvent({
    action: AUDIT_ACTIONS.ROUND_THEME_GROUP_MEMBER_MOVED,
    entityType: "theme",
    entityId: themeId,
    metadata: {
      round_id: roundId,
      previous_group_id: previousGroupId,
      target_group_id: targetGroupId,
      position: typeof position === "number" ? position : null,
    },
  });

  return { groupId: targetGroupId };
}

export async function mergeThemes(
  roundId: string,
  groupIds: string[]
) {
  if (groupIds.length < 2) {
    throw new Error("Select at least two groups to merge.");
  }

  const { userId } = await requireAuthenticatedContext();
  const round = await loadOwnedRound({ userId, roundId });
  const uniqueGroupIds = Array.from(new Set(groupIds));
  const groups = await Promise.all(
    uniqueGroupIds.map((groupId) => loadGroupForRound({ userId, roundId, groupId }))
  );
  const primaryGroup = groups[0];
  const mergedGroupIds = groups.slice(1).map((group) => group.id);
  const primaryMembers = await loadGroupMembers({ groupId: primaryGroup.id });
  const existingThemeIds = new Set(primaryMembers.map((member) => member.insight_id));
  let position = primaryMembers.length;

  for (const group of groups.slice(1)) {
    const sourceMembers = await loadGroupMembers({ groupId: group.id });

    for (const member of sourceMembers) {
      if (existingThemeIds.has(member.insight_id)) {
        await db
          .delete(themeMembers)
          .where(eq(themeMembers.id, member.id));

        continue;
      }

      await db
        .update(themeMembers)
        .set({
          themeId: primaryGroup.id,
          position,
        })
        .where(eq(themeMembers.id, member.id));

      existingThemeIds.add(member.insight_id);
      position += 1;
    }

    await db
      .update(themes)
      .set({
        status: "discarded",
        aiDraftLabel: null,
        aiDraftDescription: null,
        aiDraftExplanation: null,
        aiDraftCreatedAt: null,
        aiDraftCreatedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(themes.id, group.id));
  }

  await refreshGroupDraftForCurrentMembers({
    userId,
    round,
    groupId: primaryGroup.id,
    structuralChange: "merge_groups",
  });

  await emitAuditEvent({
    action: AUDIT_ACTIONS.ROUND_THEME_GROUP_MERGED,
    entityType: "round_theme_group",
    entityId: primaryGroup.id,
    metadata: {
      round_id: roundId,
      merged_group_ids: mergedGroupIds,
      retained_group_id: primaryGroup.id,
    },
  });

  return { groupId: primaryGroup.id };
}

export async function splitTheme(
  groupId: string,
  themeIds: string[]
) {
  if (themeIds.length === 0) {
    throw new Error("Select at least one theme to split into a new group.");
  }

  const { userId } = await requireAuthenticatedContext();
  const currentGroup = await loadGroupWithRoundContext({ userId, groupId });
  const round = currentGroup.round;
  const members = await loadGroupMembers({ groupId });
  const selectedMembers = members.filter((member) => themeIds.includes(member.insight_id));

  if (selectedMembers.length === 0) {
    throw new Error("None of the selected themes belong to this group.");
  }

  const selectedThemes = await loadInsightsForRound({
    userId,
    roundId: round.id,
    themeIds: selectedMembers.map((member) => member.insight_id),
  });
  const defaultLabel =
    selectedThemes.length === 1 ? selectedThemes[0].label : "Split theme group";
  const [created] = await db
    .insert(themes)
    .values({
      consultationId: round.id,
      userId,
      label: defaultLabel,
      description:
        selectedThemes.length === 1 ? selectedThemes[0].description ?? null : null,
      status: "draft",
      origin: "manual",
      createdBy: userId,
      lastStructuralChangeBy: userId,
    })
    .returning();

  const newGroup = mapThemeRecord(created);

  for (const [index, member] of selectedMembers.entries()) {
    await db
      .update(themeMembers)
      .set({
        themeId: newGroup.id,
        position: index,
      })
      .where(eq(themeMembers.id, member.id));
  }

  await refreshGroupDraftForCurrentMembers({
    userId,
    round,
    groupId: newGroup.id,
    structuralChange: "split_group",
  });

  const discarded = await maybeDiscardEmptyGroup({
    group: currentGroup.group,
  });

  if (!discarded) {
    await refreshGroupDraftForCurrentMembers({
      userId,
      round,
      groupId,
      structuralChange: "split_group",
    });
  }

  await emitAuditEvent({
    action: AUDIT_ACTIONS.ROUND_THEME_GROUP_SPLIT,
    entityType: "round_theme_group",
    entityId: groupId,
    metadata: {
      round_id: round.id,
      new_group_id: newGroup.id,
      theme_ids: themeIds,
    },
  });

  return { groupId: newGroup.id };
}

export async function updateTheme(
  groupId: string,
  patch: { label?: string; description?: string | null }
) {
  const { userId } = await requireAuthenticatedContext();
  const context = await loadGroupWithRoundContext({ userId, groupId });
  const nextLabel = trimToNull(patch.label) ?? context.group.label;
  const nextDescription =
    patch.description === undefined
      ? context.group.description
      : trimToNull(patch.description);

  await db
    .update(themes)
    .set({
      label: nextLabel,
      description: nextDescription,
      updatedAt: new Date(),
    })
    .where(eq(themes.id, groupId));

  await emitAuditEvent({
    action: AUDIT_ACTIONS.ROUND_THEME_GROUP_UPDATED,
    entityType: "round_theme_group",
    entityId: groupId,
    metadata: {
      round_id: context.round.id,
      label: nextLabel,
      description: nextDescription,
      edit_type: "manual_text_edit",
    },
  });

  return { groupId };
}

export async function acceptRoundTarget(
  targetType: RoundDecisionTargetType,
  targetId: string
) {
  const { userId } = await requireAuthenticatedContext();

  if (targetType === "theme_group") {
    const { group, round } = await loadGroupWithRoundContext({
      userId,
      groupId: targetId,
    });
    await db
      .update(themes)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(themes.id, group.id));

    await insertRoundDecision({
      roundId: round.id,
      userId,
      targetType,
      targetId,
      decisionType: "accepted",
      metadata: {
        origin: group.origin,
      },
    });

    await emitAuditEvent({
      action: AUDIT_ACTIONS.ROUND_TARGET_ACCEPTED,
      entityType: "round_theme_group",
      entityId: targetId,
      metadata: {
        round_id: round.id,
        target_type: targetType,
      },
    });

    return { targetId };
  }

  if (targetType === "source_theme") {
    const theme = await loadThemeWithRoundContext({ userId, themeId: targetId });

    await insertRoundDecision({
      roundId: theme.consultation.consultation_id as string,
      userId,
      targetType,
      targetId,
      decisionType: "accepted",
      metadata: {
        consultation_id: theme.consultation.id,
      },
    });

    await emitAuditEvent({
      action: AUDIT_ACTIONS.ROUND_TARGET_ACCEPTED,
      entityType: "theme",
      entityId: targetId,
      metadata: {
        round_id: theme.consultation.consultation_id,
        target_type: targetType,
      },
    });

    return { targetId };
  }

  const output = await loadRoundOutputForContext({ userId, outputId: targetId });

  await insertRoundDecision({
    roundId: output.consultation_id,
    userId,
    targetType,
    targetId,
    decisionType: "accepted",
  });

  await emitAuditEvent({
    action: AUDIT_ACTIONS.ROUND_TARGET_ACCEPTED,
    entityType: "round_output_artifact",
    entityId: targetId,
    metadata: {
      round_id: output.consultation_id,
      target_type: targetType,
    },
  });

  return { targetId };
}

export async function discardRoundTarget(
  targetType: RoundDecisionTargetType,
  targetId: string
) {
  if (targetType !== "theme_group") {
    throw new Error("Only draft round theme groups can be discarded.");
  }

  const { userId } = await requireAuthenticatedContext();
  const { group, round } = await loadGroupWithRoundContext({
    userId,
    groupId: targetId,
  });

  if (group.status !== "draft") {
    throw new Error("Only draft round theme groups can be discarded.");
  }

  await db
    .update(themes)
    .set({
      status: "discarded",
      aiDraftLabel: null,
      aiDraftDescription: null,
      aiDraftExplanation: null,
      aiDraftCreatedAt: null,
      aiDraftCreatedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(themes.id, targetId));

  await insertRoundDecision({
    roundId: round.id,
    userId,
    targetType,
    targetId,
    decisionType: "discarded",
    metadata: {
      origin: group.origin,
    },
  });

  await emitAuditEvent({
    action: AUDIT_ACTIONS.ROUND_TARGET_DISCARDED,
    entityType: "round_theme_group",
    entityId: targetId,
    metadata: {
      round_id: round.id,
      target_type: targetType,
    },
  });

  return { targetId };
}

export async function managementRejectRoundTarget(
  targetType: RoundDecisionTargetType,
  targetId: string,
  rationale: string
) {
  const trimmedRationale = trimToNull(rationale);
  const { userId } = await requireAuthenticatedContext();

  if (targetType === "theme_group") {
    const { group, round } = await loadGroupWithRoundContext({
      userId,
      groupId: targetId,
    });
    const requiresRationale = await groupHasLockedMembers({
      groupId: targetId,
    });

    if (requiresRationale && !trimmedRationale) {
      throw new Error("Management rejection rationale is required for locked themes.");
    }

    await db
      .update(themes)
      .set({ status: "management_rejected", updatedAt: new Date() })
      .where(eq(themes.id, targetId));

    await insertRoundDecision({
      roundId: round.id,
      userId,
      targetType,
      targetId,
      decisionType: "management_rejected",
      rationale: trimmedRationale,
      metadata: {
        origin: group.origin,
      },
    });

    await emitAuditEvent({
      action: AUDIT_ACTIONS.ROUND_TARGET_MANAGEMENT_REJECTED,
      entityType: "round_theme_group",
      entityId: targetId,
      metadata: {
        round_id: round.id,
        target_type: targetType,
        rationale: trimmedRationale,
      },
    });

    return { targetId };
  }

  if (targetType === "source_theme") {
    const theme = await loadThemeWithRoundContext({ userId, themeId: targetId });
    const lockedFromSource = await themeIsLockedFromSource({
      consultationId: theme.consultation.id,
    });

    if (lockedFromSource && !trimmedRationale) {
      throw new Error("Management rejection rationale is required for locked themes.");
    }

    await insertRoundDecision({
      roundId: theme.consultation.consultation_id as string,
      userId,
      targetType,
      targetId,
      decisionType: "management_rejected",
      rationale: trimmedRationale,
      metadata: {
        consultation_id: theme.consultation.id,
        locked_from_source: lockedFromSource,
      },
    });

    await emitAuditEvent({
      action: AUDIT_ACTIONS.ROUND_TARGET_MANAGEMENT_REJECTED,
      entityType: "theme",
      entityId: targetId,
      metadata: {
        round_id: theme.consultation.consultation_id,
        target_type: targetType,
        rationale: trimmedRationale,
        locked_from_source: lockedFromSource,
      },
    });

    return { targetId };
  }

  const output = await loadRoundOutputForContext({ userId, outputId: targetId });

  if (!trimmedRationale) {
    throw new Error("Management rejection rationale is required.");
  }

  await insertRoundDecision({
    roundId: output.consultation_id,
    userId,
    targetType,
    targetId,
    decisionType: "management_rejected",
    rationale: trimmedRationale,
  });

  await emitAuditEvent({
    action: AUDIT_ACTIONS.ROUND_TARGET_MANAGEMENT_REJECTED,
    entityType: "round_output_artifact",
    entityId: targetId,
    metadata: {
      round_id: output.consultation_id,
      target_type: targetType,
      rationale: trimmedRationale,
    },
  });

  return { targetId };
}

export async function acceptThemeDraft(groupId: string) {
  const { userId } = await requireAuthenticatedContext();
  const { group, round } = await loadGroupWithRoundContext({
    userId,
    groupId,
  });
  const draftLabel = trimToNull(group.ai_draft_label);
  const draftDescription = trimToNull(group.ai_draft_description);

  if (!draftLabel && !draftDescription) {
    throw new Error("This group has no pending AI draft to accept.");
  }

  await db
    .update(themes)
    .set({
      label: draftLabel ?? group.label,
      description:
        draftDescription ?? group.description ?? null,
      origin: "ai_refined",
      aiDraftLabel: null,
      aiDraftDescription: null,
      aiDraftExplanation: null,
      aiDraftCreatedAt: null,
      aiDraftCreatedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(themes.id, groupId));

  await emitAuditEvent({
    action: AUDIT_ACTIONS.ROUND_THEME_GROUP_DRAFT_ACCEPTED,
    entityType: "round_theme_group",
    entityId: groupId,
    metadata: {
      round_id: round.id,
      accepted_label: draftLabel ?? group.label,
    },
  });

  return { groupId };
}

export async function discardThemeDraft(groupId: string) {
  const { userId } = await requireAuthenticatedContext();
  const { round } = await loadGroupWithRoundContext({
    userId,
    groupId,
  });

  await db
    .update(themes)
    .set({
      aiDraftLabel: null,
      aiDraftDescription: null,
      aiDraftExplanation: null,
      aiDraftCreatedAt: null,
      aiDraftCreatedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(themes.id, groupId));

  await emitAuditEvent({
    action: AUDIT_ACTIONS.ROUND_THEME_GROUP_DRAFT_DISCARDED,
    entityType: "round_theme_group",
    entityId: groupId,
    metadata: {
      round_id: round.id,
    },
  });

  return { groupId };
}

export async function generateRoundSummary(roundId: string) {
  return generateRoundOutput(roundId, "summary");
}

export async function generateRoundReport(roundId: string) {
  return generateRoundOutput(roundId, "report");
}

export async function generateRoundEmail(roundId: string) {
  return generateRoundOutput(roundId, "email");
}

// ─── AI theme group suggestions ───────────────────────────────────────────────

export interface ThemeGroupSuggestionThemeInput {
  theme_id: string;
  label: string;
  description: string | null;
  consultation_title: string | null;
  is_user_added: boolean;
}

export interface SuggestedThemeGroup {
  label: string;
  theme_ids: string[];
  explanation: string;
}

/**
 * Ask the AI to suggest how source themes should be clustered into round_theme_groups.
 * The user provides 2+ focus themes; the AI identifies natural groupings across all themes.
 * Returns suggestions the user can accept to create actual round_theme_groups.
 */
export async function suggestThemeGroups(
  roundLabel: string | null,
  focusThemeLabels: string[],
  sourceThemes: ThemeGroupSuggestionThemeInput[]
): Promise<SuggestedThemeGroup[]> {
  const result = await callAIService("/rounds/suggest-theme-groups", {
    round_label: roundLabel,
    focus_theme_labels: focusThemeLabels,
    source_themes: sourceThemes,
  });

  return (result.groups ?? []) as SuggestedThemeGroup[];
}

async function loadThemeWithRoundContext(params: {
  userId: string;
  themeId: string;
}) {
  const { userId, themeId } = params;
  const [row] = await db
    .select({
      insight: insights,
      consultation: consultationRounds,
    })
    .from(insights)
    .innerJoin(consultationRounds, eq(insights.meetingId, consultationRounds.id))
    .where(and(eq(insights.id, themeId), eq(consultationRounds.userId, userId)))
    .limit(1);

  if (!row) {
    throw new Error("Theme not found");
  }

  return {
    ...mapInsightRecord(row.insight),
    consultation: mapConsultationRoundRecord(row.consultation),
  } satisfies InsightWithConsultation;
}

async function loadGroupWithRoundContext(params: {
  userId: string;
  groupId: string;
}) {
  const { userId, groupId } = params;
  const [row] = await db
    .select()
    .from(themes)
    .where(
      and(eq(themes.id, groupId), eq(themes.userId, userId))
    )
    .limit(1);

  if (!row) {
    throw new Error("Round theme group not found");
  }

  const group = mapThemeRecord(row);
  const round = await loadOwnedRound({
    userId,
    roundId: group.consultation_id,
  });

  return { group, round };
}

async function loadThemeMembershipForRound(params: {
  roundId: string;
  themeId: string;
}) {
  const { roundId, themeId } = params;
  const [row] = await db
    .select()
    .from(themeMembers)
    .where(
      and(
        eq(themeMembers.consultationId, roundId),
        eq(themeMembers.insightId, themeId)
      )
    )
    .limit(1);

  return row ? mapThemeMemberRecord(row) : null;
}

async function loadThemeMembershipsForRound(params: {
  roundId: string;
  themeIds: string[];
}) {
  const { roundId, themeIds } = params;

  if (themeIds.length === 0) {
    return [] as ThemeMember[];
  }

  const rows = await db
    .select()
    .from(themeMembers)
    .where(
      and(
        eq(themeMembers.consultationId, roundId),
        inArray(themeMembers.insightId, themeIds)
      )
    );

  return rows.map(mapThemeMemberRecord);
}

async function refreshGroupDraftForCurrentMembers(params: {
  userId: string;
  round: ConsultationRound;
  groupId: string;
  structuralChange: string;
}) {
  const { userId, round, groupId, structuralChange } = params;
  const group = await loadGroupForRound({
    userId,
    roundId: round.id,
    groupId,
  });
  const members = await loadGroupMembers({ groupId });
  const memberThemes = await loadInsightsForRound({
    userId,
    roundId: round.id,
    themeIds: members.map((member) => member.insight_id),
  });

  await writeGroupDraftSuggestion({
    group,
    round,
    memberThemes,
    userId,
    structuralChange,
  });
}

async function themeIsLockedFromSource(params: {
  consultationId: string;
}) {
  const { consultationId } = params;
  const rows = await db
    .select({ status: evidenceEmails.status })
    .from(evidenceEmails)
    .where(eq(evidenceEmails.meetingId, consultationId));

  return rows.some((email) => isEvidenceLocked(email.status));
}

async function groupHasLockedMembers(params: {
  groupId: string;
}) {
  const { groupId } = params;
  const members = await loadGroupMembers({ groupId });
  const consultationIds = Array.from(new Set(members.map((member) => member.source_meeting_id)));

  if (consultationIds.length === 0) {
    return false;
  }

  const lockStates = await Promise.all(
    consultationIds.map((consultationId) =>
      themeIsLockedFromSource({
        consultationId,
      })
    )
  );

  return lockStates.some(Boolean);
}

async function loadRoundOutputForContext(params: {
  userId: string;
  outputId: string;
}) {
  const { userId, outputId } = params;
  const [row] = await db
    .select()
    .from(roundOutputArtifacts)
    .where(
      and(
        eq(roundOutputArtifacts.id, outputId),
        eq(roundOutputArtifacts.userId, userId)
      )
    )
    .limit(1);

  if (!row) {
    throw new Error("Round output artifact not found");
  }

  return mapRoundOutputArtifactRecord(row);
}

async function generateRoundOutput(
  roundId: string,
  artifactType: RoundOutputArtifactType
) {
  const detail = await getRoundDetail(roundId);
  if (!detail) {
    throw new Error("Round not found.");
  }

  const { userId } = await requireAuthenticatedContext();
  const acceptedRoundThemes = detail.themeGroups
    .filter((group) => group.status === "accepted")
    .map((group) => ({
      label: group.label,
      description: group.description,
      source_kind: "round_group",
      grouped_under: null,
      consultation_title: null,
      is_user_added: group.members.some((member) => member.isUserAdded),
    }));
  const supportingConsultationThemes = detail.sourceThemes
    .filter((theme) => theme.effectiveIncluded)
    .map((theme) => ({
      label: theme.label,
      description: theme.description,
      source_kind: "consultation_theme",
      consultation_title: theme.consultationTitle,
      grouped_under: theme.groupLabel,
      is_user_added: theme.isUserAdded,
    }));

  if (
    acceptedRoundThemes.length === 0 &&
    supportingConsultationThemes.length === 0
  ) {
    throw new Error("Accept at least one round or consultation theme before generating a round output.");
  }

  // Load user's active report template (if any) to inject into the AI prompt
  const activeTemplate = await getActiveReportTemplate();

  const requestPayload = {
    round_label: detail.round.label,
    round_description: detail.round.description,
    consultations: detail.consultations.map((consultation) => consultation.title),
    accepted_round_themes: acceptedRoundThemes,
    supporting_consultation_themes: supportingConsultationThemes,
    ...(activeTemplate
      ? {
          report_template: {
            sections: activeTemplate.sections,
            style_notes: activeTemplate.style_notes,
            prescriptiveness: activeTemplate.prescriptiveness,
          },
        }
      : {}),
  };

  let generated = buildFallbackOutput({
    artifactType,
    roundLabel: detail.round.label,
    roundDescription: detail.round.description,
    consultationTitles: detail.consultations.map((consultation) => consultation.title),
    acceptedRoundThemes: acceptedRoundThemes.map((theme) => ({
      label: theme.label,
      description: theme.description ?? null,
    })),
    supportingThemes: supportingConsultationThemes.map((theme) => ({
      label: theme.label,
      description: theme.description ?? null,
      consultationTitle: theme.consultation_title ?? null,
    })),
  });

  try {
    const endpoint =
      artifactType === "summary"
        ? "/rounds/generate-summary"
        : artifactType === "report"
          ? "/rounds/generate-report"
          : "/rounds/generate-email";
    const response = (await callAIService(endpoint, requestPayload)) as {
      title?: string;
      content?: string;
    };
    const title = trimToNull(response.title);
    const content = trimToNull(response.content);

    if (title && content) {
      generated = {
        title,
        content,
      };
    }
  } catch (error) {
    console.error("[round-workflow.generateRoundOutput] AI generation failed; using fallback", {
      roundId,
      artifactType,
      requestPayload,
      error,
    });
    generated = generated;
  }

  const inputSnapshot = {
    consultationId: roundId,
    meetingTitles: requestPayload.consultations,
    accepted_consultation_themes: acceptedRoundThemes,
    supporting_meeting_themes: supportingConsultationThemes,
    graphNetwork: buildLegacyReportGraphSnapshot({
      roundId,
      snapshotAt: new Date().toISOString(),
      themeGroups: detail.themeGroups.map((group) => ({
        id: group.id,
        label: group.label,
        description: group.description,
        status: group.status,
        origin: group.origin,
        members: group.members.map((member) => ({
          insightId: member.insightId,
          sourceConsultationId: member.sourceConsultationId,
          sourceConsultationTitle: member.sourceConsultationTitle,
          label: member.label,
          description: member.description,
          isUserAdded: member.isUserAdded,
          position: member.position,
        })),
      })),
      sourceThemes: detail.sourceThemes.map((theme) => ({
        sourceThemeId: theme.sourceThemeId,
        consultationId: theme.consultationId,
        consultationTitle: theme.consultationTitle,
        label: theme.label,
        description: theme.description,
        effectiveIncluded: theme.effectiveIncluded,
        groupId: theme.groupId,
        groupLabel: theme.groupLabel,
        isUserAdded: theme.isUserAdded,
        createdAt: theme.createdAt,
      })),
    }),
  } satisfies ReportInputSnapshot;
  const [created] = await db
    .insert(roundOutputArtifacts)
    .values({
      consultationId: roundId,
      userId,
      artifactType,
      status: "generated",
      title: generated.title,
      content: generated.content,
      inputSnapshot,
      createdBy: userId,
    })
    .returning()
    .catch((error) => {
      console.error("[round-workflow.generateRoundOutput] failed to insert round output artifact", {
        roundId,
        userId,
        artifactType,
        generatedTitle: generated.title,
        generatedContentLength: generated.content.length,
        error,
      });
      throw error;
    });

  const output = mapRoundOutputArtifactRecord(created);

  await emitAuditEvent({
    action: AUDIT_ACTIONS.ROUND_OUTPUT_GENERATED,
    entityType: "round_output_artifact",
    entityId: output.id,
    metadata: {
      round_id: roundId,
      artifact_type: artifactType,
      accepted_round_theme_count: acceptedRoundThemes.length,
      supporting_consultation_theme_count: supportingConsultationThemes.length,
    },
  });

  return {
    id: output.id,
    artifactType,
    status: "generated" as const,
    title: generated.title,
    content: generated.content,
    contentPreview: previewText(generated.content, 260) ?? "",
    generatedAt: output.generated_at,
    updatedAt: output.updated_at,
    inputSnapshot,
  } satisfies RoundOutputSummary;
}

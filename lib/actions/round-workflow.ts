"use server";

import { createClient } from "@/lib/supabase/server";
import { callAIService } from "@/lib/openai/client";
import { AUDIT_ACTIONS } from "@/lib/actions/audit-actions";
import { emitAuditEvent } from "@/lib/actions/audit";
import type {
  AuditLogEntry,
  Consultation,
  ConsultationRound,
  EvidenceEmail,
  RoundDecision,
  RoundDecisionTargetType,
  RoundDecisionType,
  RoundOutputArtifact,
  RoundOutputArtifactType,
  RoundThemeGroup,
  RoundThemeGroupMember,
  Theme,
} from "@/types/db";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

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
  status: Consultation["status"];
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

export interface RoundThemeGroupMemberDetail {
  id: string;
  themeId: string;
  sourceConsultationId: string;
  sourceConsultationTitle: string;
  label: string;
  description: string | null;
  lockedFromSource: boolean;
  isUserAdded: boolean;
  position: number;
}

export interface RoundThemeGroupDraftState {
  draftLabel: string;
  draftDescription: string;
  draftExplanation: string | null;
  createdAt: string | null;
  createdBy: string | null;
}

export interface RoundThemeGroupDetail {
  id: string;
  label: string;
  description: string | null;
  status: RoundThemeGroup["status"];
  origin: RoundThemeGroup["origin"];
  currentGroup: {
    label: string;
    description: string | null;
    origin: RoundThemeGroup["origin"];
    status: RoundThemeGroup["status"];
  };
  pendingDraft: RoundThemeGroupDraftState | null;
  members: RoundThemeGroupMemberDetail[];
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
  inputSnapshot: Record<string, unknown>;
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

export interface RoundAnalyticsSummary {
  linkedConsultationCount: number;
  sourceThemeCount: number;
  groupedSourceThemeCount: number;
  acceptedGroupCount: number;
  lockedSourceThemeCount: number;
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
  themeGroups: RoundThemeGroupDetail[];
  consultationGroups: ConsultationGroupDetail[];
  decisionHistory: RoundDecisionHistoryItem[];
  outputs: RoundOutputCollection;
  history: RoundHistoryEvent[];
  analytics: RoundAnalyticsSummary;
}

interface ThemeWithConsultation extends Theme {
  consultation: Consultation;
}

interface StructuralDraftResponse {
  draft_label?: string;
  draft_description?: string;
  explanation?: string | null;
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
      ? "Round theme group"
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
      ? `Round evidence update: ${roundLabel}`
      : artifactType === "report"
        ? `${roundLabel} round report`
        : `${roundLabel} round summary`;

  const roundThemeLines =
    acceptedRoundThemes.length > 0
      ? acceptedRoundThemes.map((theme) => `- ${theme.label}: ${theme.description ?? "Accepted round theme."}`)
      : ["- No accepted round themes are available yet."];

  const supportingLines =
    supportingThemes.length > 0
      ? supportingThemes.map(
          (theme) =>
            `- ${theme.label}${theme.consultationTitle ? ` (${theme.consultationTitle})` : ""}: ${theme.description ?? "Supporting consultation theme."}`
        )
      : ["- No supporting consultation themes are available yet."];

  const content = [
    artifactType === "email"
      ? `Subject: ${header}`
      : header,
    "",
    roundDescription ? `Round description: ${roundDescription}` : null,
    consultationTitles.length > 0
      ? `Linked consultations: ${consultationTitles.join(", ")}`
      : "Linked consultations: none recorded",
    "",
    "Accepted round themes:",
    ...roundThemeLines,
    "",
    "Supporting consultation themes:",
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
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    throw new Error("Not authenticated");
  }

  return { supabase, userId: auth.user.id };
}

async function loadOwnedRound(params: {
  supabase: SupabaseServerClient;
  userId: string;
  roundId: string;
}) {
  const { supabase, userId, roundId } = params;
  const { data, error } = await supabase
    .from("consultation_rounds")
    .select("*")
    .eq("id", roundId)
    .eq("user_id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data as ConsultationRound;
}

async function loadRoundConsultations(params: {
  supabase: SupabaseServerClient;
  userId: string;
  roundId: string;
}) {
  const { supabase, userId, roundId } = params;
  const { data, error } = await supabase
    .from("consultations")
    .select("*")
    .eq("round_id", roundId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as Consultation[];
}

async function loadAcceptedThemes(params: {
  supabase: SupabaseServerClient;
  consultationIds: string[];
}) {
  const { supabase, consultationIds } = params;

  if (consultationIds.length === 0) {
    return [] as Theme[];
  }

  const { data, error } = await supabase
    .from("themes")
    .select("*")
    .eq("accepted", true)
    .in("consultation_id", consultationIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as Theme[];
}

async function loadRoundGroups(params: {
  supabase: SupabaseServerClient;
  roundId: string;
}) {
  const { supabase, roundId } = params;
  const { data, error } = await supabase
    .from("round_theme_groups")
    .select("*")
    .eq("round_id", roundId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as RoundThemeGroup[];
}

async function loadRoundGroupMembers(params: {
  supabase: SupabaseServerClient;
  roundId: string;
}) {
  const { supabase, roundId } = params;
  const { data, error } = await supabase
    .from("round_theme_group_members")
    .select("*")
    .eq("round_id", roundId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as RoundThemeGroupMember[];
}

async function loadConsultationGroups(params: {
  supabase: SupabaseServerClient;
  roundId: string;
}) {
  const { supabase, roundId } = params;
  const { data, error } = await supabase
    .from("consultation_groups")
    .select("*")
    .eq("round_id", roundId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function loadConsultationGroupMembers(params: {
  supabase: SupabaseServerClient;
  roundId: string;
}) {
  const { supabase, roundId } = params;
  const { data, error } = await supabase
    .from("consultation_group_members")
    .select("*")
    .eq("round_id", roundId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function loadRoundDecisions(params: {
  supabase: SupabaseServerClient;
  roundId: string;
}) {
  const { supabase, roundId } = params;
  const { data, error } = await supabase
    .from("round_decisions")
    .select("*")
    .eq("round_id", roundId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as RoundDecision[];
}

async function loadRoundOutputs(params: {
  supabase: SupabaseServerClient;
  roundId: string;
}) {
  const { supabase, roundId } = params;
  const { data, error } = await supabase
    .from("round_output_artifacts")
    .select("*")
    .eq("round_id", roundId)
    .order("generated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as RoundOutputArtifact[];
}

async function loadEvidenceEmailsByConsultation(params: {
  supabase: SupabaseServerClient;
  consultationIds: string[];
}) {
  const { supabase, consultationIds } = params;

  if (consultationIds.length === 0) {
    return new Map<string, EvidenceEmail[]>();
  }

  const { data, error } = await supabase
    .from("evidence_emails")
    .select("*")
    .in("consultation_id", consultationIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const emails = (data ?? []) as EvidenceEmail[];
  const grouped = new Map<string, EvidenceEmail[]>();

  emails.forEach((email) => {
    const bucket = grouped.get(email.consultation_id) ?? [];
    bucket.push(email);
    grouped.set(email.consultation_id, bucket);
  });

  return grouped;
}

async function loadRoundHistory(params: {
  supabase: SupabaseServerClient;
  userId: string;
  roundId: string;
  consultationIds: string[];
}) {
  const { supabase, userId, roundId, consultationIds } = params;
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(400);

  if (error) {
    throw error;
  }

  const consultationIdSet = new Set(consultationIds);

  return ((data ?? []) as AuditLogEntry[])
    .filter((entry) => {
      if (entry.consultation_id && consultationIdSet.has(entry.consultation_id)) {
        return true;
      }

      if (entry.entity_id === roundId) {
        return true;
      }

      const payloadRoundId = trimToNull(entry.payload?.round_id);
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
        consultationId: entry.consultation_id,
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

async function loadThemesForRound(params: {
  supabase: SupabaseServerClient;
  userId: string;
  roundId: string;
  themeIds: string[];
}) {
  const { supabase, userId, roundId, themeIds } = params;

  if (themeIds.length === 0) {
    return [] as ThemeWithConsultation[];
  }

  const { data: themeRows, error: themeError } = await supabase
    .from("themes")
    .select("*")
    .in("id", themeIds)
    .order("created_at", { ascending: true });

  if (themeError) {
    throw themeError;
  }

  const themes = (themeRows ?? []) as Theme[];
  const consultationIds = Array.from(new Set(themes.map((theme) => theme.consultation_id)));
  const { data: consultationRows, error: consultationError } = await supabase
    .from("consultations")
    .select("*")
    .in("id", consultationIds)
    .eq("user_id", userId)
    .eq("round_id", roundId);

  if (consultationError) {
    throw consultationError;
  }

  const consultationById = new Map(
    ((consultationRows ?? []) as Consultation[]).map((consultation) => [consultation.id, consultation])
  );

  return themes
    .map((theme) => {
      const consultation = consultationById.get(theme.consultation_id);
      if (!consultation) {
        return null;
      }

      return {
        ...theme,
        consultation,
      } satisfies ThemeWithConsultation;
    })
    .filter((value): value is ThemeWithConsultation => value !== null);
}

async function loadGroupForRound(params: {
  supabase: SupabaseServerClient;
  userId: string;
  roundId: string;
  groupId: string;
}) {
  const { supabase, userId, roundId, groupId } = params;
  const { data, error } = await supabase
    .from("round_theme_groups")
    .select("*")
    .eq("id", groupId)
    .eq("round_id", roundId)
    .eq("user_id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data as RoundThemeGroup;
}

async function loadGroupMembers(params: {
  supabase: SupabaseServerClient;
  groupId: string;
}) {
  const { supabase, groupId } = params;
  const { data, error } = await supabase
    .from("round_theme_group_members")
    .select("*")
    .eq("group_id", groupId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as RoundThemeGroupMember[];
}

async function writeGroupDraftSuggestion(params: {
  supabase: SupabaseServerClient;
  group: RoundThemeGroup;
  round: ConsultationRound;
  memberThemes: ThemeWithConsultation[];
  userId: string;
  structuralChange: string;
}) {
  const { supabase, group, round, memberThemes, userId, structuralChange } = params;

  if (memberThemes.length === 0) {
    const { error } = await supabase
      .from("round_theme_groups")
      .update({
        ai_draft_label: null,
        ai_draft_description: null,
        ai_draft_explanation: null,
        ai_draft_created_at: null,
        ai_draft_created_by: null,
        last_structural_change_at: new Date().toISOString(),
        last_structural_change_by: userId,
      })
      .eq("id", group.id);

    if (error) {
      throw error;
    }

    return null;
  }

  const fallback = buildFallbackDraft({
    structuralChange,
    memberThemes,
  });

  let draft = fallback;

  try {
    const response = (await callAIService("/rounds/refine-group-draft", {
      round_label: round.label,
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

  const timestamp = new Date().toISOString();
  const { error } = await supabase
    .from("round_theme_groups")
    .update({
      ai_draft_label: draft.draftLabel,
      ai_draft_description: draft.draftDescription,
      ai_draft_explanation: draft.draftExplanation,
      ai_draft_created_at: timestamp,
      ai_draft_created_by: userId,
      last_structural_change_at: timestamp,
      last_structural_change_by: userId,
    })
    .eq("id", group.id);

  if (error) {
    throw error;
  }

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

async function maybeDiscardEmptyGroup(params: {
  supabase: SupabaseServerClient;
  group: RoundThemeGroup;
}) {
  const { supabase, group } = params;
  const members = await loadGroupMembers({ supabase, groupId: group.id });

  if (members.length > 0) {
    return false;
  }

  const { error } = await supabase
    .from("round_theme_groups")
    .update({
      status: "discarded",
      ai_draft_label: null,
      ai_draft_description: null,
      ai_draft_explanation: null,
      ai_draft_created_at: null,
      ai_draft_created_by: null,
    })
    .eq("id", group.id);

  if (error) {
    throw error;
  }

  return true;
}

async function insertRoundDecision(params: {
  supabase: SupabaseServerClient;
  roundId: string;
  userId: string;
  targetType: RoundDecisionTargetType;
  targetId: string;
  decisionType: RoundDecisionType;
  rationale?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { supabase, roundId, userId, targetType, targetId, decisionType, rationale, metadata } = params;

  const { error } = await supabase.from("round_decisions").insert({
    round_id: roundId,
    user_id: userId,
    target_type: targetType,
    target_id: targetId,
    decision_type: decisionType,
    rationale: trimToNull(rationale),
    metadata: metadata ?? null,
  });

  if (error) {
    throw error;
  }
}

function mapTargetStatus(decision: RoundDecision | undefined): RoundTargetStatus {
  if (!decision) {
    return "unreviewed";
  }

  return decision.decision_type;
}

export async function getRoundDetail(roundId: string): Promise<RoundDetail | null> {
  const { supabase, userId } = await requireAuthenticatedContext();
  const round = await loadOwnedRound({ supabase, userId, roundId });
  const consultations = await loadRoundConsultations({ supabase, userId, roundId });
  const consultationIds = consultations.map((consultation) => consultation.id);
  const [themes, groups, members, decisions, outputs, emailMap, history, consultationGroups, consultationGroupMembers] =
    await Promise.all([
      loadAcceptedThemes({ supabase, consultationIds }),
      loadRoundGroups({ supabase, roundId }),
      loadRoundGroupMembers({ supabase, roundId }),
      loadRoundDecisions({ supabase, roundId }),
      loadRoundOutputs({ supabase, roundId }),
      loadEvidenceEmailsByConsultation({ supabase, consultationIds }),
      loadRoundHistory({ supabase, userId, roundId, consultationIds }),
      loadConsultationGroups({ supabase, roundId }),
      loadConsultationGroupMembers({ supabase, roundId }),
    ]);

  const consultationById = new Map(consultations.map((consultation) => [consultation.id, consultation]));
  const latestDecisionMap = latestDecisionByTarget(decisions);
  const memberByThemeId = new Map<string, RoundThemeGroupMember>();

  members.forEach((member) => {
    memberByThemeId.set(member.theme_id, member);
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

  const themeById = new Map(themes.map((theme) => [theme.id, theme]));
  const sourceThemes = themes.map((theme): RoundSourceTheme => {
    const consultation = consultationById.get(theme.consultation_id);
    if (!consultation) {
      throw new Error("Theme consultation mismatch in round detail payload");
    }

    const consultationSummary = consultationItems.find((item) => item.id === consultation.id);
    const member = memberByThemeId.get(theme.id);
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
      groupId: member?.group_id ?? null,
      groupLabel: member ? groups.find((group) => group.id === member.group_id)?.label ?? null : null,
      createdAt: theme.created_at,
    };
  });

  const groupDetails = groups.map((group): RoundThemeGroupDetail => {
    const groupMembers = members
      .filter((member) => member.group_id === group.id)
      .map((member) => {
        const theme = themeById.get(member.theme_id);
        const consultation = consultationById.get(member.source_consultation_id);
        const consultationSummary = consultation
          ? consultationItems.find((item) => item.id === consultation.id)
          : null;

        if (!theme || !consultation) {
          throw new Error("Round theme group member is missing theme or consultation context");
        }

        return {
          id: member.id,
          themeId: theme.id,
          sourceConsultationId: consultation.id,
          sourceConsultationTitle: consultation.title,
          label: theme.label,
          description: theme.description ?? null,
          lockedFromSource: consultationSummary?.hasLockedEvidence ?? false,
          isUserAdded: theme.is_user_added,
          position: member.position,
        } satisfies RoundThemeGroupMemberDetail;
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
      label: round.label,
      description: round.description ?? null,
      linkedConsultationCount: consultations.length,
    },
    consultations: consultationItems,
    sourceThemes,
    themeGroups: groupDetails,
    consultationGroups: consultationGroupDetails,
    decisionHistory: decisions.map((decision) => ({
      id: decision.id,
      targetType: decision.target_type,
      targetId: decision.target_id,
      decisionType: decision.decision_type,
      rationale: decision.rationale ?? null,
      actor: decision.user_id,
      timestamp: decision.created_at,
      metadata: decision.metadata ?? null,
    })),
    outputs: buildOutputCollection(outputs),
    history,
    analytics: {
      linkedConsultationCount: consultations.length,
      sourceThemeCount: sourceThemes.length,
      groupedSourceThemeCount: sourceThemes.filter((theme) => theme.isGrouped).length,
      acceptedGroupCount: groupDetails.filter((group) => group.status === "accepted").length,
      lockedSourceThemeCount: sourceThemes.filter((theme) => theme.lockedFromSource).length,
    },
  };
}

export async function createRoundThemeGroup(
  roundId: string,
  seedThemeIds: string[] = []
) {
  const { supabase, userId } = await requireAuthenticatedContext();
  const round = await loadOwnedRound({ supabase, userId, roundId });
  const seedThemes = await loadThemesForRound({
    supabase,
    userId,
    roundId,
    themeIds: seedThemeIds,
  });
  const existingMemberships = await loadThemeMembershipsForRound({
    supabase,
    roundId,
    themeIds: seedThemes.map((theme) => theme.id),
  });
  const previousGroupIds = Array.from(
    new Set(existingMemberships.map((membership) => membership.group_id))
  );

  const defaultLabel =
    seedThemes.length === 1 ? seedThemes[0].label : "Round theme group";
  const { data, error } = await supabase
    .from("round_theme_groups")
    .insert({
      round_id: roundId,
      user_id: userId,
      label: defaultLabel,
      description:
        seedThemes.length === 1 ? seedThemes[0].description ?? null : null,
      status: "draft",
      origin: "manual",
      created_by: userId,
      last_structural_change_by: userId,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const group = data as RoundThemeGroup;

  if (seedThemes.length > 0) {
    const { error: deleteMembershipError } = await supabase
      .from("round_theme_group_members")
      .delete()
      .eq("round_id", roundId)
      .in(
        "theme_id",
        seedThemes.map((theme) => theme.id)
      );

    if (deleteMembershipError) {
      throw deleteMembershipError;
    }

    const { error: memberError } = await supabase
      .from("round_theme_group_members")
      .insert(
        seedThemes.map((theme, index) => ({
          group_id: group.id,
          round_id: roundId,
          theme_id: theme.id,
          source_consultation_id: theme.consultation.id,
          user_id: userId,
          position: index,
          created_by: userId,
        }))
      );

    if (memberError) {
      throw memberError;
    }

    await writeGroupDraftSuggestion({
      supabase,
      group,
      round,
      memberThemes: seedThemes,
      userId,
      structuralChange: "create_group",
    });

    for (const previousGroupId of previousGroupIds) {
      const previousGroup = await loadGroupForRound({
        supabase,
        userId,
        roundId,
        groupId: previousGroupId,
      });
      const discarded = await maybeDiscardEmptyGroup({
        supabase,
        group: previousGroup,
      });

      if (!discarded) {
        await refreshGroupDraftForCurrentMembers({
          supabase,
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
  const { supabase, userId } = await requireAuthenticatedContext();
  const theme = await loadThemeWithRoundContext({ supabase, userId, themeId });
  const roundId = theme.consultation.round_id;

  if (!roundId) {
    throw new Error("The source theme is not assigned to a round.");
  }

  const round = await loadOwnedRound({ supabase, userId, roundId });
  const currentMembership = await loadThemeMembershipForRound({
    supabase,
    roundId,
    themeId,
  });

  let targetGroup: RoundThemeGroup | null = null;
  if (targetGroupId) {
    targetGroup = await loadGroupForRound({
      supabase,
      userId,
      roundId,
      groupId: targetGroupId,
    });
  }

  const previousGroupId = currentMembership?.group_id ?? null;

  if (currentMembership && currentMembership.group_id === targetGroupId) {
    if (typeof position === "number") {
      const { error } = await supabase
        .from("round_theme_group_members")
        .update({ position })
        .eq("id", currentMembership.id);

      if (error) {
        throw error;
      }
    }

    return { groupId: targetGroupId };
  }

  if (currentMembership) {
    const { error } = await supabase
      .from("round_theme_group_members")
      .delete()
      .eq("id", currentMembership.id);

    if (error) {
      throw error;
    }
  }

  if (targetGroup) {
    const targetMembers = await loadGroupMembers({
      supabase,
      groupId: targetGroup.id,
    });
    const nextPosition =
      typeof position === "number" ? position : targetMembers.length;
    const { error } = await supabase.from("round_theme_group_members").insert({
      group_id: targetGroup.id,
      round_id: roundId,
      theme_id: theme.id,
      source_consultation_id: theme.consultation.id,
      user_id: userId,
      position: nextPosition,
      created_by: userId,
    });

    if (error) {
      throw error;
    }
  }

  if (previousGroupId) {
    const previousGroup = await loadGroupForRound({
      supabase,
      userId,
      roundId,
      groupId: previousGroupId,
    });
    const discarded = await maybeDiscardEmptyGroup({
      supabase,
      group: previousGroup,
    });

    if (!discarded) {
      await refreshGroupDraftForCurrentMembers({
        supabase,
        userId,
        round,
        groupId: previousGroupId,
        structuralChange: "move_theme_out_of_group",
      });
    }
  }

  if (targetGroup) {
    await refreshGroupDraftForCurrentMembers({
      supabase,
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

export async function mergeRoundThemeGroups(
  roundId: string,
  groupIds: string[]
) {
  if (groupIds.length < 2) {
    throw new Error("Select at least two groups to merge.");
  }

  const { supabase, userId } = await requireAuthenticatedContext();
  const round = await loadOwnedRound({ supabase, userId, roundId });
  const uniqueGroupIds = Array.from(new Set(groupIds));
  const groups = await Promise.all(
    uniqueGroupIds.map((groupId) =>
      loadGroupForRound({ supabase, userId, roundId, groupId })
    )
  );
  const primaryGroup = groups[0];
  const mergedGroupIds = groups.slice(1).map((group) => group.id);
  const primaryMembers = await loadGroupMembers({
    supabase,
    groupId: primaryGroup.id,
  });
  const existingThemeIds = new Set(primaryMembers.map((member) => member.theme_id));
  let position = primaryMembers.length;

  for (const group of groups.slice(1)) {
    const sourceMembers = await loadGroupMembers({ supabase, groupId: group.id });

    for (const member of sourceMembers) {
      if (existingThemeIds.has(member.theme_id)) {
        const { error } = await supabase
          .from("round_theme_group_members")
          .delete()
          .eq("id", member.id);

        if (error) {
          throw error;
        }

        continue;
      }

      const { error } = await supabase
        .from("round_theme_group_members")
        .update({
          group_id: primaryGroup.id,
          position,
        })
        .eq("id", member.id);

      if (error) {
        throw error;
      }

      existingThemeIds.add(member.theme_id);
      position += 1;
    }

    const { error: statusError } = await supabase
      .from("round_theme_groups")
      .update({
        status: "discarded",
        ai_draft_label: null,
        ai_draft_description: null,
        ai_draft_explanation: null,
        ai_draft_created_at: null,
        ai_draft_created_by: null,
      })
      .eq("id", group.id);

    if (statusError) {
      throw statusError;
    }
  }

  await refreshGroupDraftForCurrentMembers({
    supabase,
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

export async function splitRoundThemeGroup(
  groupId: string,
  themeIds: string[]
) {
  if (themeIds.length === 0) {
    throw new Error("Select at least one theme to split into a new group.");
  }

  const { supabase, userId } = await requireAuthenticatedContext();
  const currentGroup = await loadGroupWithRoundContext({ supabase, userId, groupId });
  const round = await loadOwnedRound({
    supabase,
    userId,
    roundId: currentGroup.round.id,
  });
  const members = await loadGroupMembers({ supabase, groupId });
  const selectedMembers = members.filter((member) => themeIds.includes(member.theme_id));

  if (selectedMembers.length === 0) {
    throw new Error("None of the selected themes belong to this group.");
  }

  const selectedThemes = await loadThemesForRound({
    supabase,
    userId,
    roundId: round.id,
    themeIds: selectedMembers.map((member) => member.theme_id),
  });
  const defaultLabel =
    selectedThemes.length === 1 ? selectedThemes[0].label : "Split theme group";
  const { data, error } = await supabase
    .from("round_theme_groups")
    .insert({
      round_id: round.id,
      user_id: userId,
      label: defaultLabel,
      description:
        selectedThemes.length === 1 ? selectedThemes[0].description ?? null : null,
      status: "draft",
      origin: "manual",
      created_by: userId,
      last_structural_change_by: userId,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const newGroup = data as RoundThemeGroup;

  for (const [index, member] of selectedMembers.entries()) {
    const { error: moveError } = await supabase
      .from("round_theme_group_members")
      .update({
        group_id: newGroup.id,
        position: index,
      })
      .eq("id", member.id);

    if (moveError) {
      throw moveError;
    }
  }

  await refreshGroupDraftForCurrentMembers({
    supabase,
    userId,
    round,
    groupId: newGroup.id,
    structuralChange: "split_group",
  });

  const discarded = await maybeDiscardEmptyGroup({
    supabase,
    group: currentGroup.group,
  });

  if (!discarded) {
    await refreshGroupDraftForCurrentMembers({
      supabase,
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

export async function updateRoundThemeGroup(
  groupId: string,
  patch: { label?: string; description?: string | null }
) {
  const { supabase, userId } = await requireAuthenticatedContext();
  const context = await loadGroupWithRoundContext({ supabase, userId, groupId });
  const nextLabel = trimToNull(patch.label) ?? context.group.label;
  const nextDescription =
    patch.description === undefined
      ? context.group.description
      : trimToNull(patch.description);

  const { error } = await supabase
    .from("round_theme_groups")
    .update({
      label: nextLabel,
      description: nextDescription,
    })
    .eq("id", groupId);

  if (error) {
    throw error;
  }

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
  const { supabase, userId } = await requireAuthenticatedContext();

  if (targetType === "theme_group") {
    const { group, round } = await loadGroupWithRoundContext({
      supabase,
      userId,
      groupId: targetId,
    });
    const { error } = await supabase
      .from("round_theme_groups")
      .update({ status: "accepted" })
      .eq("id", group.id);

    if (error) {
      throw error;
    }

    await insertRoundDecision({
      supabase,
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
    const theme = await loadThemeWithRoundContext({ supabase, userId, themeId: targetId });

    await insertRoundDecision({
      supabase,
      roundId: theme.consultation.round_id as string,
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
        round_id: theme.consultation.round_id,
        target_type: targetType,
      },
    });

    return { targetId };
  }

  const output = await loadRoundOutputForContext({ supabase, userId, outputId: targetId });

  await insertRoundDecision({
    supabase,
    roundId: output.round_id,
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
      round_id: output.round_id,
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

  const { supabase, userId } = await requireAuthenticatedContext();
  const { group, round } = await loadGroupWithRoundContext({
    supabase,
    userId,
    groupId: targetId,
  });

  if (group.status !== "draft") {
    throw new Error("Only draft round theme groups can be discarded.");
  }

  const { error } = await supabase
    .from("round_theme_groups")
    .update({
      status: "discarded",
      ai_draft_label: null,
      ai_draft_description: null,
      ai_draft_explanation: null,
      ai_draft_created_at: null,
      ai_draft_created_by: null,
    })
    .eq("id", targetId);

  if (error) {
    throw error;
  }

  await insertRoundDecision({
    supabase,
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
  const { supabase, userId } = await requireAuthenticatedContext();

  if (targetType === "theme_group") {
    const { group, round } = await loadGroupWithRoundContext({
      supabase,
      userId,
      groupId: targetId,
    });
    const requiresRationale = await groupHasLockedMembers({
      supabase,
      groupId: targetId,
    });

    if (requiresRationale && !trimmedRationale) {
      throw new Error("Management rejection rationale is required for locked themes.");
    }

    const { error } = await supabase
      .from("round_theme_groups")
      .update({ status: "management_rejected" })
      .eq("id", targetId);

    if (error) {
      throw error;
    }

    await insertRoundDecision({
      supabase,
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
    const theme = await loadThemeWithRoundContext({ supabase, userId, themeId: targetId });
    const lockedFromSource = await themeIsLockedFromSource({
      supabase,
      consultationId: theme.consultation.id,
    });

    if (lockedFromSource && !trimmedRationale) {
      throw new Error("Management rejection rationale is required for locked themes.");
    }

    await insertRoundDecision({
      supabase,
      roundId: theme.consultation.round_id as string,
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
        round_id: theme.consultation.round_id,
        target_type: targetType,
        rationale: trimmedRationale,
        locked_from_source: lockedFromSource,
      },
    });

    return { targetId };
  }

  const output = await loadRoundOutputForContext({ supabase, userId, outputId: targetId });

  if (!trimmedRationale) {
    throw new Error("Management rejection rationale is required.");
  }

  await insertRoundDecision({
    supabase,
    roundId: output.round_id,
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
      round_id: output.round_id,
      target_type: targetType,
      rationale: trimmedRationale,
    },
  });

  return { targetId };
}

export async function acceptRoundThemeGroupDraft(groupId: string) {
  const { supabase, userId } = await requireAuthenticatedContext();
  const { group, round } = await loadGroupWithRoundContext({
    supabase,
    userId,
    groupId,
  });
  const draftLabel = trimToNull(group.ai_draft_label);
  const draftDescription = trimToNull(group.ai_draft_description);

  if (!draftLabel && !draftDescription) {
    throw new Error("This group has no pending AI draft to accept.");
  }

  const { error } = await supabase
    .from("round_theme_groups")
    .update({
      label: draftLabel ?? group.label,
      description:
        draftDescription ?? group.description ?? null,
      origin: "ai_refined",
      ai_draft_label: null,
      ai_draft_description: null,
      ai_draft_explanation: null,
      ai_draft_created_at: null,
      ai_draft_created_by: null,
    })
    .eq("id", groupId);

  if (error) {
    throw error;
  }

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

export async function discardRoundThemeGroupDraft(groupId: string) {
  const { supabase, userId } = await requireAuthenticatedContext();
  const { round } = await loadGroupWithRoundContext({
    supabase,
    userId,
    groupId,
  });

  const { error } = await supabase
    .from("round_theme_groups")
    .update({
      ai_draft_label: null,
      ai_draft_description: null,
      ai_draft_explanation: null,
      ai_draft_created_at: null,
      ai_draft_created_by: null,
    })
    .eq("id", groupId);

  if (error) {
    throw error;
  }

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
  supabase: SupabaseServerClient;
  userId: string;
  themeId: string;
}) {
  const { supabase, userId, themeId } = params;
  const { data: themeData, error: themeError } = await supabase
    .from("themes")
    .select("*")
    .eq("id", themeId)
    .single();

  if (themeError) {
    throw themeError;
  }

  const theme = themeData as Theme;
  const { data: consultationData, error: consultationError } = await supabase
    .from("consultations")
    .select("*")
    .eq("id", theme.consultation_id)
    .eq("user_id", userId)
    .single();

  if (consultationError) {
    throw consultationError;
  }

  return {
    ...theme,
    consultation: consultationData as Consultation,
  } satisfies ThemeWithConsultation;
}

async function loadGroupWithRoundContext(params: {
  supabase: SupabaseServerClient;
  userId: string;
  groupId: string;
}) {
  const { supabase, userId, groupId } = params;
  const { data, error } = await supabase
    .from("round_theme_groups")
    .select("*")
    .eq("id", groupId)
    .eq("user_id", userId)
    .single();

  if (error) {
    throw error;
  }

  const group = data as RoundThemeGroup;
  const round = await loadOwnedRound({
    supabase,
    userId,
    roundId: group.round_id,
  });

  return { group, round };
}

async function loadThemeMembershipForRound(params: {
  supabase: SupabaseServerClient;
  roundId: string;
  themeId: string;
}) {
  const { supabase, roundId, themeId } = params;
  const { data, error } = await supabase
    .from("round_theme_group_members")
    .select("*")
    .eq("round_id", roundId)
    .eq("theme_id", themeId)
    .limit(1);

  if (error) {
    throw error;
  }

  return ((data ?? []) as RoundThemeGroupMember[])[0] ?? null;
}

async function loadThemeMembershipsForRound(params: {
  supabase: SupabaseServerClient;
  roundId: string;
  themeIds: string[];
}) {
  const { supabase, roundId, themeIds } = params;

  if (themeIds.length === 0) {
    return [] as RoundThemeGroupMember[];
  }

  const { data, error } = await supabase
    .from("round_theme_group_members")
    .select("*")
    .eq("round_id", roundId)
    .in("theme_id", themeIds);

  if (error) {
    throw error;
  }

  return (data ?? []) as RoundThemeGroupMember[];
}

async function refreshGroupDraftForCurrentMembers(params: {
  supabase: SupabaseServerClient;
  userId: string;
  round: ConsultationRound;
  groupId: string;
  structuralChange: string;
}) {
  const { supabase, userId, round, groupId, structuralChange } = params;
  const group = await loadGroupForRound({
    supabase,
    userId,
    roundId: round.id,
    groupId,
  });
  const members = await loadGroupMembers({ supabase, groupId });
  const memberThemes = await loadThemesForRound({
    supabase,
    userId,
    roundId: round.id,
    themeIds: members.map((member) => member.theme_id),
  });

  await writeGroupDraftSuggestion({
    supabase,
    group,
    round,
    memberThemes,
    userId,
    structuralChange,
  });
}

async function themeIsLockedFromSource(params: {
  supabase: SupabaseServerClient;
  consultationId: string;
}) {
  const { supabase, consultationId } = params;
  const { data, error } = await supabase
    .from("evidence_emails")
    .select("status")
    .eq("consultation_id", consultationId);

  if (error) {
    throw error;
  }

  return ((data ?? []) as Pick<EvidenceEmail, "status">[]).some((email) =>
    isEvidenceLocked(email.status)
  );
}

async function groupHasLockedMembers(params: {
  supabase: SupabaseServerClient;
  groupId: string;
}) {
  const { supabase, groupId } = params;
  const members = await loadGroupMembers({ supabase, groupId });
  const consultationIds = Array.from(new Set(members.map((member) => member.source_consultation_id)));

  if (consultationIds.length === 0) {
    return false;
  }

  const lockStates = await Promise.all(
    consultationIds.map((consultationId) =>
      themeIsLockedFromSource({
        supabase,
        consultationId,
      })
    )
  );

  return lockStates.some(Boolean);
}

async function loadRoundOutputForContext(params: {
  supabase: SupabaseServerClient;
  userId: string;
  outputId: string;
}) {
  const { supabase, userId, outputId } = params;
  const { data, error } = await supabase
    .from("round_output_artifacts")
    .select("*")
    .eq("id", outputId)
    .eq("user_id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data as RoundOutputArtifact;
}

async function generateRoundOutput(
  roundId: string,
  artifactType: RoundOutputArtifactType
) {
  const detail = await getRoundDetail(roundId);
  if (!detail) {
    throw new Error("Round not found.");
  }

  const { supabase, userId } = await requireAuthenticatedContext();
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

  const requestPayload = {
    round_label: detail.round.label,
    round_description: detail.round.description,
    consultations: detail.consultations.map((consultation) => consultation.title),
    accepted_round_themes: acceptedRoundThemes,
    supporting_consultation_themes: supportingConsultationThemes,
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
  } catch {
    generated = generated;
  }

  const inputSnapshot = {
    round_id: roundId,
    consultations: requestPayload.consultations,
    accepted_round_themes: acceptedRoundThemes,
    supporting_consultation_themes: supportingConsultationThemes,
  };
  const { data, error } = await supabase
    .from("round_output_artifacts")
    .insert({
      round_id: roundId,
      user_id: userId,
      artifact_type: artifactType,
      status: "generated",
      title: generated.title,
      content: generated.content,
      input_snapshot: inputSnapshot,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await emitAuditEvent({
    action: AUDIT_ACTIONS.ROUND_OUTPUT_GENERATED,
    entityType: "round_output_artifact",
    entityId: (data as RoundOutputArtifact).id,
    metadata: {
      round_id: roundId,
      artifact_type: artifactType,
      accepted_round_theme_count: acceptedRoundThemes.length,
      supporting_consultation_theme_count: supportingConsultationThemes.length,
    },
  });

  return {
    id: (data as RoundOutputArtifact).id,
    artifactType,
    status: "generated" as const,
    title: generated.title,
    content: generated.content,
    contentPreview: previewText(generated.content, 260) ?? "",
    generatedAt: (data as RoundOutputArtifact).generated_at,
    updatedAt: (data as RoundOutputArtifact).updated_at,
    inputSnapshot,
  } satisfies RoundOutputSummary;
}

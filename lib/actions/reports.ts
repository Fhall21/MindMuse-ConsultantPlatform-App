"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  AuditLogEntry,
  Consultation,
  ConsultationRound,
  Theme,
} from "@/types/db";

type ConsultationContext = Pick<Consultation, "id" | "title" | "round_id">;
type RoundContext = Pick<ConsultationRound, "id" | "label" | "description">;

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
  consultation: ConsultationContext | null;
  round: RoundContext | null;
  isUserAdded: boolean;
}): ThemeProvenanceContext {
  const { consultation, round, isUserAdded } = params;

  return {
    consultationId: consultation?.id ?? null,
    consultationTitle: consultation?.title ?? null,
    roundId: round?.id ?? consultation?.round_id ?? null,
    roundLabel: round?.label ?? null,
    isUserAdded,
  };
}

function buildAcceptedConsultationThemeReference(params: {
  theme: Theme;
  consultation: ConsultationContext;
  round: RoundContext | null;
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
  themes: Theme[];
  consultationById: Map<string, ConsultationContext>;
  round: RoundContext;
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
    const consultation = consultationById.get(theme.consultation_id) ?? null;
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
  consultationById: Map<string, ConsultationContext>;
  roundById: Map<string, RoundContext>;
}): ReportThemeReference | null {
  const { event, consultationById, roundById } = params;
  const payload = event.payload ?? {};
  const rationale = getStringValue(payload.rationale);

  if (!rationale) {
    return null;
  }

  const roundId = getStringValue(payload.round_id);
  const consultation = event.consultation_id
    ? (consultationById.get(event.consultation_id) ?? null)
    : null;
  const round = roundId ? (roundById.get(roundId) ?? null) : null;
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

async function requireAuthenticatedClient() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    throw new Error("Not authenticated");
  }

  return { supabase, userId: auth.user.id };
}

async function loadConsultationById(params: {
  consultationId: string;
}): Promise<Consultation | null> {
  const { consultationId } = params;
  const { supabase } = await requireAuthenticatedClient();

  const { data, error } = await supabase
    .from("consultations")
    .select("*")
    .eq("id", consultationId)
    .single();

  if (error) {
    throw error;
  }

  return (data as Consultation | null) ?? null;
}

async function loadRoundContext(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  roundId: string;
}): Promise<RoundContext | null> {
  const { supabase, roundId } = params;
  const { data, error } = await supabase
    .from("consultation_rounds")
    .select("*")
    .eq("id", roundId)
    .single();

  if (error) {
    throw error;
  }

  return (data as ConsultationRound | null) ?? null;
}

async function loadRejectedAuditEvents(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  consultationIds: string[];
}): Promise<AuditLogEntry[]> {
  const { supabase, userId, consultationIds } = params;

  if (consultationIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("action", "theme.rejected")
    .eq("user_id", userId)
    .in("consultation_id", consultationIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as AuditLogEntry[];
}

async function loadRoundSummaryInternal(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  round: RoundContext;
}): Promise<RoundSummaryData> {
  const { supabase, userId, round } = params;

  const { data: consultationRows, error: consultationError } = await supabase
    .from("consultations")
    .select("id, title, round_id")
    .eq("round_id", round.id)
    .order("created_at", { ascending: true });

  if (consultationError) {
    throw consultationError;
  }

  const consultations = (consultationRows ?? []) as ConsultationContext[];
  const consultationIds = consultations.map((consultation) => consultation.id);
  const consultationById = new Map(
    consultations.map((consultation) => [consultation.id, consultation])
  );

  let acceptedThemes: Theme[] = [];

  if (consultationIds.length > 0) {
    const { data: themeRows, error: themeError } = await supabase
      .from("themes")
      .select("*")
      .eq("accepted", true)
      .in("consultation_id", consultationIds)
      .order("created_at", { ascending: false });

    if (themeError) {
      throw themeError;
    }

    acceptedThemes = (themeRows ?? []) as Theme[];
  }

  const rejectedEvents = await loadRejectedAuditEvents({
    supabase,
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
  const { supabase, userId } = await requireAuthenticatedClient();
  const round = await loadRoundContext({ supabase, roundId });

  if (!round) {
    return null;
  }

  return loadRoundSummaryInternal({
    supabase,
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
  inputSnapshot: Record<string, unknown>;
  consultationTitles: string[];
  acceptedThemeCount: number;
  supportingThemeCount: number;
  versionNumber: number;
  totalVersions: number;
}

function previewContent(content: string, maxLength = 200): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.slice(0, maxLength).trimEnd() + "…";
}

export async function getReportArtifacts(): Promise<ReportArtifactListItem[]> {
  const { supabase } = await requireAuthenticatedClient();

  // Get the latest artifact per (round_id, artifact_type) using distinct on
  // Supabase JS doesn't support DISTINCT ON, so we fetch all and dedupe client-side
  const { data: artifacts, error: artifactsError } = await supabase
    .from("round_output_artifacts")
    .select("*")
    .order("generated_at", { ascending: false });

  if (artifactsError) {
    throw artifactsError;
  }

  if (!artifacts || artifacts.length === 0) {
    return [];
  }

  // Dedupe to latest per (round_id, artifact_type)
  const seen = new Set<string>();
  const latestArtifacts: typeof artifacts = [];

  for (const artifact of artifacts) {
    const key = `${artifact.round_id}:${artifact.artifact_type}`;
    if (!seen.has(key)) {
      seen.add(key);
      latestArtifacts.push(artifact);
    }
  }

  // Load round labels
  const roundIds = Array.from(new Set(latestArtifacts.map((a) => a.round_id)));
  const { data: rounds } = await supabase
    .from("consultation_rounds")
    .select("id, label")
    .in("id", roundIds);

  const roundLabelById = new Map(
    (rounds ?? []).map((r: { id: string; label: string }) => [r.id, r.label])
  );

  return latestArtifacts.map((artifact) => ({
    id: artifact.id,
    artifactType: artifact.artifact_type as "summary" | "report" | "email",
    title: artifact.title ?? null,
    contentPreview: previewContent(artifact.content),
    roundId: artifact.round_id,
    roundLabel: roundLabelById.get(artifact.round_id) ?? "Unknown round",
    generatedAt: artifact.generated_at,
    updatedAt: artifact.updated_at,
  }));
}

export async function getReportArtifact(
  artifactId: string
): Promise<ReportArtifactDetail | null> {
  const { supabase } = await requireAuthenticatedClient();

  const { data: artifact, error: artifactError } = await supabase
    .from("round_output_artifacts")
    .select("*")
    .eq("id", artifactId)
    .single();

  if (artifactError || !artifact) {
    return null;
  }

  // Load round context
  const { data: round } = await supabase
    .from("consultation_rounds")
    .select("id, label, description")
    .eq("id", artifact.round_id)
    .single();

  // Count versions of this artifact type for this round
  const { count: totalVersions } = await supabase
    .from("round_output_artifacts")
    .select("id", { count: "exact", head: true })
    .eq("round_id", artifact.round_id)
    .eq("artifact_type", artifact.artifact_type);

  // Determine version number (1 = oldest)
  const { count: olderCount } = await supabase
    .from("round_output_artifacts")
    .select("id", { count: "exact", head: true })
    .eq("round_id", artifact.round_id)
    .eq("artifact_type", artifact.artifact_type)
    .lte("generated_at", artifact.generated_at);

  const inputSnapshot = (artifact.input_snapshot ?? {}) as Record<string, unknown>;
  const consultationTitles = Array.isArray(inputSnapshot.consultations)
    ? (inputSnapshot.consultations as string[])
    : [];
  const acceptedThemeCount = Array.isArray(inputSnapshot.accepted_round_themes)
    ? inputSnapshot.accepted_round_themes.length
    : 0;
  const supportingThemeCount = Array.isArray(inputSnapshot.supporting_consultation_themes)
    ? inputSnapshot.supporting_consultation_themes.length
    : 0;

  return {
    id: artifact.id,
    artifactType: artifact.artifact_type as "summary" | "report" | "email",
    title: artifact.title ?? null,
    content: artifact.content,
    roundId: artifact.round_id,
    roundLabel: round?.label ?? "Unknown round",
    roundDescription: round?.description ?? null,
    generatedAt: artifact.generated_at,
    updatedAt: artifact.updated_at,
    inputSnapshot,
    consultationTitles,
    acceptedThemeCount,
    supportingThemeCount,
    versionNumber: olderCount ?? 1,
    totalVersions: totalVersions ?? 1,
  };
}

export async function getReportArtifactVersions(
  roundId: string,
  artifactType: string
): Promise<ReportArtifactListItem[]> {
  const { supabase } = await requireAuthenticatedClient();

  const { data: artifacts, error } = await supabase
    .from("round_output_artifacts")
    .select("*")
    .eq("round_id", roundId)
    .eq("artifact_type", artifactType)
    .order("generated_at", { ascending: false });

  if (error) {
    throw error;
  }

  // Load round label
  const { data: round } = await supabase
    .from("consultation_rounds")
    .select("id, label")
    .eq("id", roundId)
    .single();

  const roundLabel = round?.label ?? "Unknown round";

  return (artifacts ?? []).map((artifact) => ({
    id: artifact.id,
    artifactType: artifact.artifact_type as "summary" | "report" | "email",
    title: artifact.title ?? null,
    contentPreview: previewContent(artifact.content),
    roundId: artifact.round_id,
    roundLabel,
    generatedAt: artifact.generated_at,
    updatedAt: artifact.updated_at,
  }));
}

export async function getConsultationReportData(
  consultationId: string
): Promise<ConsultationReportData | null> {
  const { supabase, userId } = await requireAuthenticatedClient();
  const consultation = await loadConsultationById({ consultationId });

  if (!consultation) {
    return null;
  }

  const consultationContext: ConsultationContext = {
    id: consultation.id,
    title: consultation.title,
    round_id: consultation.round_id,
  };

  const { data: localThemeRows, error: localThemeError } = await supabase
    .from("themes")
    .select("*")
    .eq("consultation_id", consultationId)
    .eq("accepted", true)
    .order("created_at", { ascending: false });

  if (localThemeError) {
    throw localThemeError;
  }

  const localAcceptedThemes = (localThemeRows ?? []) as Theme[];
  const round = consultation.round_id
    ? await loadRoundContext({ supabase, roundId: consultation.round_id })
    : null;

  const consultationThemes = localAcceptedThemes
    .map((theme) =>
      buildAcceptedConsultationThemeReference({
        theme,
        consultation: consultationContext,
        round,
      })
    )
    .sort((left, right) => left.label.localeCompare(right.label));

  if (!round) {
    const rejectedEvents = await loadRejectedAuditEvents({
      supabase,
      userId,
      consultationIds: [consultationId],
    });

    const consultationById = new Map([[consultation.id, consultationContext]]);
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
    supabase,
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

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { insightDecisionLogs, insights, meetings } from "@/db/schema";
import {
  scheduleLearningAnalysis,
  getThemeLearningSignalCountForUser,
} from "@/lib/data/ai-learnings";
import { requireOwnedMeeting, requireOwnedTheme } from "@/lib/data/ownership";
import { AUDIT_ACTIONS } from "@/lib/actions/audit-actions";
import { emitAuditEvent } from "@/lib/actions/audit";
import { dispatchToolToFastApi } from "./tool-dispatch";
import { CHAT_TOOL_ENDPOINTS } from "./tool-allowlist";
import { loadThemePersonalizationContext } from "./theme-personalization";
import {
  buildThemeReviewOutput,
  normalizeExtractedThemes,
  readThemeReviewOutput,
  type ThemeDecision,
  type ThemeReviewItem,
  type ThemeReviewOutput,
} from "./tools/themes";
import {
  dismissPriorPendingToolResults,
  getToolResultForSession,
  updateToolResult,
} from "./persist";

const MIN_SIGNALS_FOR_LEARNING_ANALYSIS = 5;

function trimToNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function triggerLearningAnalysisIfReady(userId: string) {
  try {
    const signalCount = await getThemeLearningSignalCountForUser(userId);
    if (signalCount < MIN_SIGNALS_FOR_LEARNING_ANALYSIS) {
      return;
    }
    await scheduleLearningAnalysis(userId);
  } catch (error) {
    console.warn("[chat.themes-db] learning analysis schedule failed", { userId, error });
  }
}

export async function loadMeetingTranscript(
  userId: string,
  meetingId: string
): Promise<{ ok: true; transcript: string } | { ok: false; error: string }> {
  const meeting = await requireOwnedMeeting(meetingId, userId);
  const transcript =
    meeting.transcriptRaw?.trim() ||
    meeting.notes?.trim() ||
    "";

  if (!transcript) {
    return {
      ok: false,
      error: "Meeting has no transcript or notes to extract themes from.",
    };
  }

  return { ok: true, transcript };
}

async function insertInsightsForMeeting(
  userId: string,
  meetingId: string,
  drafts: Array<{ label: string; description: string; confidence: number }>
): Promise<ThemeReviewItem[]> {
  const meeting = await requireOwnedMeeting(meetingId, userId);

  if (drafts.length === 0) {
    return [];
  }

  const rows = await db
    .insert(insights)
    .values(
      drafts.map((draft) => ({
        meetingId: meeting.id,
        label: draft.label,
        description: draft.description || null,
        accepted: false,
        isUserAdded: false,
      }))
    )
    .returning({ id: insights.id, label: insights.label, description: insights.description });

  await emitAuditEvent({
    consultationId: meeting.consultationId,
    action: AUDIT_ACTIONS.THEME_EXTRACTION_REQUESTED,
    entityType: "themes",
    metadata: { count: drafts.length, source: "chat_extract_themes" },
  });

  return rows.map((row, index) => ({
    id: row.id,
    label: row.label,
    description: row.description ?? drafts[index]?.description ?? "",
    source_quotes: [],
    confidence: drafts[index]?.confidence ?? 0.5,
  }));
}

export async function extractAndPersistThemes(params: {
  userId: string;
  sessionId: string;
  meetingId: string;
}): Promise<{ ok: true; output: ThemeReviewOutput } | { ok: false; error: string }> {
  const transcriptResult = await loadMeetingTranscript(params.userId, params.meetingId);
  if (!transcriptResult.ok) {
    return transcriptResult;
  }

  const personalization = await loadThemePersonalizationContext(params.userId);

  const result = await dispatchToolToFastApi({
    userId: params.userId,
    sessionId: params.sessionId,
    endpoint: CHAT_TOOL_ENDPOINTS.extract_themes,
    body: {
      transcript: transcriptResult.transcript,
      ...personalization,
    },
  });

  if (!result.ok) {
    return result;
  }

  const drafts = normalizeExtractedThemes(result.data);
  if (drafts.length === 0) {
    return { ok: false, error: "The AI service did not return any themes." };
  }

  await dismissPriorPendingToolResults(params.sessionId, "extract_themes");

  const themes = await insertInsightsForMeeting(params.userId, params.meetingId, drafts);

  return {
    ok: true,
    output: buildThemeReviewOutput({
      meetingId: params.meetingId,
      themes,
    }),
  };
}

export async function acceptInsightForMeeting(params: {
  userId: string;
  meetingId: string;
  insightId: string;
}): Promise<void> {
  const { meeting, theme } = await requireOwnedTheme(
    params.insightId,
    params.meetingId,
    params.userId
  );

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(insights)
      .set({ accepted: true, rejected: false, rejectedAt: null })
      .where(
        and(eq(insights.id, theme.id), eq(insights.meetingId, params.meetingId))
      )
      .returning({ id: insights.id });

    if (updated.length === 0) {
      throw new Error("Theme no longer exists in this meeting.");
    }

    await tx.insert(insightDecisionLogs).values({
      userId: params.userId,
      meetingId: params.meetingId,
      insightId: theme.id,
      insightLabel: theme.label,
      consultationId: meeting.consultationId ?? null,
      decisionType: "accept",
      rationale: null,
    });
  });

  await emitAuditEvent({
    consultationId: params.meetingId,
    action: AUDIT_ACTIONS.THEME_ACCEPTED,
    entityType: "theme",
    entityId: theme.id,
    metadata: {
      decision_type: "accept",
      theme_label: theme.label,
      consultation_id: meeting.consultationId,
      source: "chat_theme_review",
    },
  });

  await triggerLearningAnalysisIfReady(params.userId);
}

export async function rejectInsightForMeeting(params: {
  userId: string;
  meetingId: string;
  insightId: string;
  rationale?: string;
}): Promise<void> {
  const { meeting, theme } = await requireOwnedTheme(
    params.insightId,
    params.meetingId,
    params.userId
  );

  const trimmedRationale = trimToNull(params.rationale);
  const requiresRationale = meeting.status !== "draft";
  if (requiresRationale && !trimmedRationale) {
    throw new Error("A rejection rationale is required once the meeting is locked.");
  }

  const [logRecord] = await db
    .insert(insightDecisionLogs)
    .values({
      userId: params.userId,
      meetingId: params.meetingId,
      insightId: params.insightId,
      insightLabel: theme.label,
      consultationId: meeting.consultationId ?? null,
      decisionType: "reject",
      rationale: trimmedRationale,
    })
    .returning({ id: insightDecisionLogs.id });

  try {
    await db
      .update(insights)
      .set({ rejected: true, rejectedAt: new Date(), accepted: false })
      .where(
        and(eq(insights.id, params.insightId), eq(insights.meetingId, params.meetingId))
      );
  } catch (error) {
    await db.delete(insightDecisionLogs).where(eq(insightDecisionLogs.id, logRecord.id));
    throw error;
  }

  await emitAuditEvent({
    consultationId: params.meetingId,
    action: AUDIT_ACTIONS.THEME_REJECTED,
    entityType: "theme",
    entityId: params.insightId,
    metadata: {
      decision_type: "reject",
      theme_label: theme.label,
      rationale: trimmedRationale,
      consultation_id: meeting.consultationId,
      source: "chat_theme_review",
    },
  });

  await triggerLearningAnalysisIfReady(params.userId);
}

export async function updateThemeReviewToolResult(params: {
  toolResultId: string;
  sessionId: string;
  output: ThemeReviewOutput;
  status?: "pending" | "success" | "dismissed";
}) {
  return updateToolResult({
    toolResultId: params.toolResultId,
    sessionId: params.sessionId,
    output: params.output,
    status: params.status ?? "pending",
  });
}

export async function finalizeThemeReview(params: {
  userId: string;
  sessionId: string;
  meetingId: string;
  acceptedThemeIds: string[];
  rejectedThemeIds: string[];
  toolResultId?: string;
}): Promise<ThemeReviewItem[]> {
  if (params.toolResultId) {
    const existing = await getToolResultForSession(params.toolResultId, params.sessionId);
    if (!existing) {
      throw new Error("Tool result not found");
    }

    const output =
      existing.output && typeof existing.output === "object"
        ? readThemeReviewOutput(existing.output)
        : null;

    if (output) {
      await updateToolResult({
        toolResultId: params.toolResultId,
        sessionId: params.sessionId,
        output,
        status: "success",
      });
    }
  }

  const allIds = [...params.acceptedThemeIds, ...params.rejectedThemeIds];
  if (allIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: insights.id,
      label: insights.label,
      description: insights.description,
      accepted: insights.accepted,
    })
    .from(insights)
    .where(
      and(
        eq(insights.meetingId, params.meetingId),
        inArray(insights.id, params.acceptedThemeIds)
      )
    );

  await requireOwnedMeeting(params.meetingId, params.userId);

  return rows
    .filter((row) => row.accepted)
    .map((row) => ({
      id: row.id,
      label: row.label,
      description: row.description ?? "",
      source_quotes: [],
      confidence: 0.5,
    }));
}

export function mergeThemeDecision(
  output: ThemeReviewOutput,
  themeId: string,
  decision: ThemeDecision
): ThemeReviewOutput {
  return {
    ...output,
    decisions: {
      ...output.decisions,
      [themeId]: decision,
    },
  };
}

export function hasAnyAcceptedDecision(decisions: Record<string, ThemeDecision>): boolean {
  return Object.values(decisions).some((value) => value === "accepted");
}

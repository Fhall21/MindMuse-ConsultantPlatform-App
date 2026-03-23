"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { insightDecisionLogs, insights } from "@/db/schema";
import {
  enqueueLearningAnalysis,
  getThemeLearningSignalCountForUser,
} from "@/lib/data/ai-learnings";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import {
  requireOwnedMeeting,
  requireOwnedTheme,
} from "@/lib/data/ownership";
import { AUDIT_ACTIONS } from "./audit-actions";
import { emitAuditEvent } from "./audit";

interface ThemeData {
  label: string;
  confidence?: number;
  description?: string | null;
}

const MIN_SIGNALS_FOR_LEARNING_ANALYSIS = 5;

function trimToNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeRequiredId(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

async function triggerLearningAnalysisIfReady(userId: string) {
  try {
    const signalCount = await getThemeLearningSignalCountForUser(userId);
    if (signalCount < MIN_SIGNALS_FOR_LEARNING_ANALYSIS) {
      return;
    }

    await enqueueLearningAnalysis(userId);
  } catch (error) {
    console.warn("[themes.learning-analysis] enqueue failed", {
      userId,
      error,
    });
  }
}

export async function saveThemes(
  meetingId: string,
  themeItems: ThemeData[]
) {
  const userId = await requireCurrentUserId();
  const meeting = await requireOwnedMeeting(meetingId, userId);

  const themesWithMeetingId = themeItems.map((theme) => ({
    meetingId: meeting.id,
    label: theme.label,
    description: theme.description ?? null,
    accepted: false,
    isUserAdded: false,
  }));

  const data = await db
    .insert(insights)
    .values(themesWithMeetingId)
    .returning({ id: insights.id });

  await emitAuditEvent({
    consultationId: meeting.consultationId,
    action: AUDIT_ACTIONS.THEME_EXTRACTION_REQUESTED,
    entityType: "themes",
    metadata: { count: themeItems.length },
  });

  return data;
}

/**
 * Accept a theme and log the decision for learning signals
 * Optionally associate with a consultation round
 */
export async function acceptTheme(
  id: string,
  meetingId: string,
  roundId?: string
) {
  try {
    const normalizedInsightId = normalizeRequiredId(id, "Insight ID");
    const normalizedMeetingId = normalizeRequiredId(
      meetingId,
      "Meeting ID"
    );
    const userId = await requireCurrentUserId();
    const { meeting, theme } = await requireOwnedTheme(
      normalizedInsightId,
      normalizedMeetingId,
      userId
    );

    await db.transaction(async (tx) => {
      const updated = await tx
        .update(insights)
        .set({ accepted: true })
        .where(
          and(
            eq(insights.id, theme.id),
            eq(insights.meetingId, normalizedMeetingId)
          )
        )
        .returning({ id: insights.id });

      if (updated.length === 0) {
        throw new Error("Theme no longer exists in this meeting.");
      }

      await tx.insert(insightDecisionLogs).values({
        userId,
        meetingId: normalizedMeetingId,
        insightId: theme.id,
        insightLabel: theme.label,
        consultationId: meeting.consultationId ?? null,
        decisionType: "accept",
        rationale: null,
      });
    });

    // Emit audit event with decision context
    await emitAuditEvent({
      consultationId: normalizedMeetingId,
      action: AUDIT_ACTIONS.THEME_ACCEPTED,
      entityType: "theme",
      entityId: theme.id,
      metadata: {
        decision_type: "accept",
        theme_label: theme.label,
        consultation_id: meeting.consultationId,
      },
    });

    await triggerLearningAnalysisIfReady(userId);
  } catch (error) {
    console.error("[themes.acceptTheme] failed", {
      insightId: id,
      meetingId,
      roundId: roundId ?? null,
      error,
    });
    throw error;
  }
}

/**
 * Reject a theme and remove it from active use.
 * Rationale is optional while the consultation is still draft, but remains
 * required once the consultation is locked.
 */
export async function rejectTheme(
  id: string,
  meetingId: string,
  rationale: string = "",
  roundId?: string
) {
  const trimmedRationale = trimToNull(rationale);
  const userId = await requireCurrentUserId();
  const normalizedMeetingId = normalizeRequiredId(meetingId, "Meeting ID");
  const { meeting, theme } = await requireOwnedTheme(id, normalizedMeetingId, userId);

  const requiresRationale = meeting.status !== "draft";
  if (requiresRationale && !trimmedRationale) {
    throw new Error("A rejection rationale is required once the meeting is locked.");
  }

  const [logRecord] = await db
    .insert(insightDecisionLogs)
    .values({
      userId,
      meetingId: normalizedMeetingId,
      insightId: id,
      insightLabel: theme.label,
      consultationId: meeting.consultationId ?? null,
      decisionType: "reject",
      rationale: trimmedRationale,
    })
    .returning({ id: insightDecisionLogs.id });

  // Delete the theme
  try {
    await db
      .delete(insights)
      .where(and(eq(insights.id, id), eq(insights.meetingId, normalizedMeetingId)));
  } catch (error) {
    await db.delete(insightDecisionLogs).where(eq(insightDecisionLogs.id, logRecord.id));
    throw error;
  }

  // Emit audit event with decision metadata
  await emitAuditEvent({
    consultationId: normalizedMeetingId,
    action: AUDIT_ACTIONS.THEME_REJECTED,
    entityType: "theme",
    entityId: id,
    metadata: {
      decision_type: "reject",
      theme_label: theme.label,
      rationale: trimmedRationale,
      consultation_id: meeting.consultationId,
    },
  });

  await triggerLearningAnalysisIfReady(userId);
}

/**
 * Add a user-created theme with learning signal tracking
 * User-added themes get higher weight for AI personalization
 */
export async function addUserTheme(
  meetingId: string,
  label: string,
  description?: string,
  roundId?: string
) {
  const userId = await requireCurrentUserId();
  const meeting = await requireOwnedMeeting(meetingId, userId);

  // Insert the theme with user_added flag and higher weight
  const [themeData] = await db
    .insert(insights)
    .values({
      meetingId: meeting.id,
      label,
      description: description || null,
      accepted: true, // User-added themes start as accepted
      isUserAdded: true,
      weight: "2.0", // Higher weight for user-added themes
    })
    .returning({ id: insights.id });

  const themeId = themeData.id;

  // Log the decision for learning signals
  await db.insert(insightDecisionLogs).values({
      userId,
      meetingId: meeting.id,
      insightId: themeId,
      insightLabel: label,
      consultationId: meeting.consultationId ?? null,
      decisionType: "user_added",
      rationale: null,
    });

  // Emit audit event
  await emitAuditEvent({
    consultationId: meeting.id,
    action: AUDIT_ACTIONS.THEME_USER_ADDED,
    entityType: "theme",
    entityId: themeId,
    metadata: {
      decision_type: "user_added",
      label,
      consultation_id: meeting.consultationId,
    },
  });

  await triggerLearningAnalysisIfReady(userId);

  return themeData;
}

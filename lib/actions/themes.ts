"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { consultations, themeDecisionLogs, themes } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import {
  requireOwnedConsultation,
  requireOwnedTheme,
} from "@/lib/data/ownership";
import { AUDIT_ACTIONS } from "./audit-actions";
import { emitAuditEvent } from "./audit";

interface ThemeData {
  label: string;
  confidence?: number;
  description?: string | null;
}

function trimToNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function saveThemes(
  consultationId: string,
  themeItems: ThemeData[]
) {
  const userId = await requireCurrentUserId();
  await requireOwnedConsultation(consultationId, userId);

  const themesWithConsultationId = themeItems.map((theme) => ({
    consultationId,
    label: theme.label,
    description: theme.description ?? null,
    accepted: false,
    isUserAdded: false,
  }));

  const data = await db
    .insert(themes)
    .values(themesWithConsultationId)
    .returning({ id: themes.id });

  await emitAuditEvent({
    consultationId,
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
  consultationId: string,
  roundId?: string
) {
  const userId = await requireCurrentUserId();
  const { theme } = await requireOwnedTheme(id, consultationId, userId);

  await db
    .update(themes)
    .set({ accepted: true })
    .where(and(eq(themes.id, id), eq(themes.consultationId, consultationId)));

  await db.insert(themeDecisionLogs).values({
    userId,
    consultationId,
    themeId: id,
    themeLabel: theme.label,
    roundId: roundId || null,
    decisionType: "accept",
    rationale: null,
  });

  // Emit audit event with decision context
  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.THEME_ACCEPTED,
    entityType: "theme",
    entityId: id,
    metadata: {
      decision_type: "accept",
      theme_label: theme.label,
      round_id: roundId || null,
    },
  });
}

/**
 * Reject a theme and remove it from active use.
 * Rationale is optional while the consultation is still draft, but remains
 * required once the consultation is locked.
 */
export async function rejectTheme(
  id: string,
  consultationId: string,
  rationale: string = "",
  roundId?: string
) {
  const trimmedRationale = trimToNull(rationale);
  const userId = await requireCurrentUserId();
  const { consultation, theme } = await requireOwnedTheme(id, consultationId, userId);

  const requiresRationale = consultation.status !== "draft";
  if (requiresRationale && !trimmedRationale) {
    throw new Error("A rejection rationale is required once the consultation is locked.");
  }

  const [logRecord] = await db
    .insert(themeDecisionLogs)
    .values({
      userId,
      consultationId,
      themeId: id,
      themeLabel: theme.label,
      roundId: roundId || null,
      decisionType: "reject",
      rationale: trimmedRationale,
    })
    .returning({ id: themeDecisionLogs.id });

  // Delete the theme
  try {
    await db
      .delete(themes)
      .where(and(eq(themes.id, id), eq(themes.consultationId, consultationId)));
  } catch (error) {
    await db.delete(themeDecisionLogs).where(eq(themeDecisionLogs.id, logRecord.id));
    throw error;
  }

  // Emit audit event with decision metadata
  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.THEME_REJECTED,
    entityType: "theme",
    entityId: id,
    metadata: {
      decision_type: "reject",
      theme_label: theme.label,
      rationale: trimmedRationale,
      round_id: roundId || null,
    },
  });
}

/**
 * Add a user-created theme with learning signal tracking
 * User-added themes get higher weight for AI personalization
 */
export async function addUserTheme(
  consultationId: string,
  label: string,
  description?: string,
  roundId?: string
) {
  const userId = await requireCurrentUserId();
  await requireOwnedConsultation(consultationId, userId);

  // Insert the theme with user_added flag and higher weight
  const [themeData] = await db
    .insert(themes)
    .values({
      consultationId,
      label,
      description: description || null,
      accepted: true, // User-added themes start as accepted
      isUserAdded: true,
      weight: "2.0", // Higher weight for user-added themes
    })
    .returning({ id: themes.id });

  const themeId = themeData.id;

  // Log the decision for learning signals
  await db.insert(themeDecisionLogs).values({
      userId,
      consultationId,
      themeId,
      themeLabel: label,
      roundId: roundId || null,
      decisionType: "user_added",
      rationale: null,
    });

  // Emit audit event
  await emitAuditEvent({
    consultationId,
    action: AUDIT_ACTIONS.THEME_USER_ADDED,
    entityType: "theme",
    entityId: themeId,
    metadata: {
      decision_type: "user_added",
      label,
      round_id: roundId || null,
    },
  });

  return themeData;
}

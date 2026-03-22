"use server";

import { db } from "@/db/client";
import { consultationCrossInsights as roundCrossInsights } from "@/db/schema";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import { requireOwnedRound } from "@/lib/data/ownership";
import { AUDIT_ACTIONS } from "@/lib/actions/audit-actions";
import { emitAuditEvent } from "@/lib/actions/audit";

export async function addRoundCrossInsight(
  roundId: string,
  consultationId: string,
  label: string,
  description?: string
) {
  const userId = await requireCurrentUserId();
  await requireOwnedRound(roundId, userId);

  const [created] = await db
    .insert(roundCrossInsights)
    .values({
      consultationId: roundId,
      label,
      description: description ?? null,
      sourceMeetingIds: [consultationId],
      createdBy: userId,
    })
    .returning({
      id: roundCrossInsights.id,
      roundId: roundCrossInsights.consultationId,
      label: roundCrossInsights.label,
      description: roundCrossInsights.description,
      sourceMeetingIds: roundCrossInsights.sourceMeetingIds,
      createdBy: roundCrossInsights.createdBy,
      createdAt: roundCrossInsights.createdAt,
    });

  await emitAuditEvent({
    consultationId: null,
    action: AUDIT_ACTIONS.ROUND_CROSS_INSIGHT_ADDED,
    entityType: "round_cross_insight",
    entityId: created.id,
    metadata: {
      roundId,
      consultationId,
      label,
      description: description ?? null,
    },
  });

  return created;
}

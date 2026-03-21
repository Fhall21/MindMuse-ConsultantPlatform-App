"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  termClusters,
  termClusterMemberships,
  roundCrossInsights,
  themes,
} from "@/db/schema";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import { requireOwnedRound } from "@/lib/data/ownership";
import { AUDIT_ACTIONS } from "@/lib/actions/audit-actions";
import { emitAuditEvent } from "@/lib/actions/audit";

/**
 * Add an analytics cluster as a cross-consultation insight and create a theme group.
 *
 * - Creates a round_cross_insights entry with auto-generated description
 * - Creates a themes group to organize the insight
 * - Description format: "N consultations mentioned terms such as term1, term2, term3..."
 */
export async function addAnalyticsClusterAsInsight(roundId: string, clusterId: number) {
  const userId = await requireCurrentUserId();
  await requireOwnedRound(roundId, userId);

  // Fetch cluster data
  const cluster = await db.query.termClusters.findFirst({
    where: and(eq(termClusters.roundId, roundId), eq(termClusters.clusterId, clusterId)),
  });

  if (!cluster) {
    throw new Error(`Cluster ${clusterId} not found for round ${roundId}.`);
  }

  // Fetch all memberships for this cluster to get unique consultations
  const memberships = await db.query.termClusterMemberships.findMany({
    where: and(
      eq(termClusterMemberships.roundId, roundId),
      eq(termClusterMemberships.clusterId, clusterId)
    ),
  });

  if (memberships.length === 0) {
    throw new Error(`No memberships found for cluster ${clusterId}.`);
  }

  // Get unique consultation IDs and terms
  const uniqueConsultationIds = Array.from(new Set(memberships.map((m) => m.consultationId)));
  const uniqueTerms = Array.from(new Set(memberships.map((m) => m.term)));

  // Generate description: "N consultations mentioned terms such as term1, term2, term3..."
  const termList = uniqueTerms.slice(0, 5).join(", ");
  const termSuffix = uniqueTerms.length > 5 ? `, +${uniqueTerms.length - 5} more` : "";
  const consultationWord = uniqueConsultationIds.length === 1 ? "consultation" : "consultations";
  const description = `${uniqueConsultationIds.length} ${consultationWord} mentioned terms such as ${termList}${termSuffix}`;

  // Create round_cross_insights entry
  const [insight] = await db
    .insert(roundCrossInsights)
    .values({
      roundId,
      label: cluster.label,
      description,
      sourceConsultationIds: uniqueConsultationIds,
      createdBy: userId,
    })
    .returning();

  // Create themes group with cluster label
  const [group] = await db
    .insert(themes)
    .values({
      roundId,
      userId,
      label: cluster.label,
      description: description,
      status: "draft",
      origin: "manual",
      createdBy: userId,
      lastStructuralChangeBy: userId,
    })
    .returning();

  // Emit audit events
  await emitAuditEvent({
    consultationId: null,
    action: AUDIT_ACTIONS.ROUND_CROSS_INSIGHT_ADDED,
    entityType: "round_cross_insight",
    entityId: insight.id,
    metadata: {
      roundId,
      clusterId,
      clusterLabel: cluster.label,
      sourceConsultationIds: uniqueConsultationIds,
      termCount: uniqueTerms.length,
    },
  });

  await emitAuditEvent({
    consultationId: null,
    action: AUDIT_ACTIONS.ROUND_THEME_GROUP_CREATED,
    entityType: "round_theme_group",
    entityId: group.id,
    metadata: {
      roundId,
      clusterId,
      insightId: insight.id,
      label: cluster.label,
    },
  });

  return {
    insightId: insight.id,
    groupId: group.id,
    clusterLabel: cluster.label,
    description,
    consultationCount: uniqueConsultationIds.length,
    termCount: uniqueTerms.length,
  };
}

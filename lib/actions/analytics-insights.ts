"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  termClusters,
  termClusterMemberships,
  consultationCrossInsights,
  themes,
  insights,
  themeMembers,
} from "@/db/schema";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import { requireOwnedConsultation } from "@/lib/data/ownership";
import { AUDIT_ACTIONS } from "@/lib/actions/audit-actions";
import { emitAuditEvent } from "@/lib/actions/audit";

/**
 * Add an analytics cluster as a cross-consultation insight and create a theme group.
 *
 * - Creates a consultation_cross_insights entry with auto-generated description
 * - Creates a themes group to organize the insight
 * - Description format: "N meetings mentioned terms such as term1, term2, term3..."
 */
export async function addAnalyticsClusterAsInsight(consultationId: string, clusterId: number) {
  const userId = await requireCurrentUserId();
  await requireOwnedConsultation(consultationId, userId);

  // Fetch cluster data
  const cluster = await db.query.termClusters.findFirst({
    where: and(eq(termClusters.consultationId, consultationId), eq(termClusters.clusterId, clusterId)),
  });

  if (!cluster) {
    throw new Error(`Cluster ${clusterId} not found for consultation ${consultationId}.`);
  }

  // Fetch all memberships for this cluster to get unique meetings
  const memberships = await db.query.termClusterMemberships.findMany({
    where: and(
      eq(termClusterMemberships.consultationId, consultationId),
      eq(termClusterMemberships.clusterId, clusterId)
    ),
  });

  if (memberships.length === 0) {
    throw new Error(`No memberships found for cluster ${clusterId}.`);
  }

  // Get unique meeting IDs and terms
  const uniqueMeetingIds = Array.from(new Set(memberships.map((m) => m.meetingId)));
  const uniqueTerms = Array.from(new Set(memberships.map((m) => m.term)));

  // Generate description: "N meetings mentioned terms such as term1, term2, term3..."
  const termList = uniqueTerms.slice(0, 5).join(", ");
  const termSuffix = uniqueTerms.length > 5 ? `, +${uniqueTerms.length - 5} more` : "";
  const meetingWord = uniqueMeetingIds.length === 1 ? "meeting" : "meetings";
  const description = `${uniqueMeetingIds.length} ${meetingWord} mentioned terms such as ${termList}${termSuffix}`;

  // Create consultation_cross_insights entry (metadata about the pattern)
  const [crossInsight] = await db
    .insert(consultationCrossInsights)
    .values({
      consultationId,
      label: cluster.label,
      description,
      sourceMeetingIds: uniqueMeetingIds,
      createdBy: userId,
    })
    .returning();

  // Create themes group with cluster label
  const [group] = await db
    .insert(themes)
    .values({
      consultationId,
      userId,
      label: cluster.label,
      description,
      status: "draft",
      origin: "manual",
      createdBy: userId,
      lastStructuralChangeBy: userId,
    })
    .returning();

  // Create insights entry (one per cluster, scoped to first meeting for DB compatibility)
  // This allows the cluster to be manipulated as an independent insight in the theme grouping
  const [clusterInsight] = await db
    .insert(insights)
    .values({
      meetingId: uniqueMeetingIds[0],
      label: cluster.label,
      description: description,
      accepted: true,
      isUserAdded: true,
    })
    .returning();

  // Link the insight to the theme group via themeMembers
  await db.insert(themeMembers).values({
    themeId: group.id,
    consultationId,
    insightId: clusterInsight.id,
    sourceMeetingId: uniqueMeetingIds[0],
    userId,
    createdBy: userId,
  });

  // Emit audit events
  await emitAuditEvent({
    consultationId: null,
    action: AUDIT_ACTIONS.ROUND_CROSS_INSIGHT_ADDED,
    entityType: "round_cross_insight",
    entityId: crossInsight.id,
    metadata: {
      consultationId,
      clusterId,
      clusterLabel: cluster.label,
      sourceMeetingIds: uniqueMeetingIds,
      termCount: uniqueTerms.length,
    },
  });

  await emitAuditEvent({
    consultationId: null,
    action: AUDIT_ACTIONS.ROUND_THEME_GROUP_CREATED,
    entityType: "round_theme_group",
    entityId: group.id,
    metadata: {
      consultationId,
      clusterId,
      insightId: clusterInsight.id,
      label: cluster.label,
    },
  });

  return {
    crossInsightId: crossInsight.id,
    groupId: group.id,
    clusterInsightId: clusterInsight.id,
    clusterLabel: cluster.label,
    description,
    meetingCount: uniqueMeetingIds.length,
    termCount: uniqueTerms.length,
  };
}

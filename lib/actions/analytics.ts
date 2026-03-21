"use server";

import { and, desc, eq, inArray, asc } from "drizzle-orm";
import { db } from "@/db/client";
import {
  analyticsJobs,
  auditLog,
  consultations,
  roundDecisions,
  termClusters,
} from "@/db/schema";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import {
  requireOwnedConsultation,
  requireOwnedRound,
} from "@/lib/data/ownership";
import { AUDIT_ACTIONS } from "./audit-actions";
import {
  getConsultationAnalytics,
  getRoundAnalytics,
  getRoundAnalyticsSummary,
} from "@/lib/data/analytics-read";
import type {
  AnalyticsClusterDecisionAction,
  AnalyticsClusterDecisionResponse,
  AnalyticsJobStatus,
  AnalyticsJobTriggerResponse,
  ConsultationAnalytics,
  RoundAnalytics,
  RoundAnalyticsJobsResponse,
  RoundAnalyticsResponse,
} from "@/types/analytics";

const ACTIVE_JOB_PHASES = [
  "queued",
  "extracting",
  "embedding",
  "clustering",
  "syncing",
] as const;

type AnalyticsJobRow = typeof analyticsJobs.$inferSelect;

type AnalyticsDbWriter = Pick<typeof db, "insert">;

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.toISOString();
}

function trimToNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function mapJobRow(row: AnalyticsJobRow): AnalyticsJobStatus {
  return {
    jobId: row.id,
    consultationId: row.consultationId,
    roundId: row.roundId ?? null,
    phase: row.phase,
    progress: row.progress,
    startedAt: toIsoString(row.startedAt),
    completedAt: toIsoString(row.completedAt),
    errorMessage: row.errorMessage ?? null,
  };
}

async function insertAnalyticsAuditLog(
  tx: AnalyticsDbWriter,
  params: {
    consultationId?: string | null;
    userId: string;
    action: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }
) {
  await tx.insert(auditLog).values({
    consultationId: params.consultationId ?? null,
    userId: params.userId,
    action: params.action,
    entityType: params.entityType ?? null,
    entityId: params.entityId ? params.entityId : null,
    payload: params.metadata ?? null,
  });
}

async function getLatestJobForConsultation(consultationId: string) {
  const [row] = await db
    .select()
    .from(analyticsJobs)
    .where(eq(analyticsJobs.consultationId, consultationId))
    .orderBy(desc(analyticsJobs.createdAt))
    .limit(1);

  return row ?? null;
}

async function getLatestJobStatusesForRound(roundId: string) {
  const consultationRows = await db
    .select({ id: consultations.id })
    .from(consultations)
    .where(eq(consultations.roundId, roundId))
    .orderBy(asc(consultations.createdAt));

  const latestJobs = await db
    .select()
    .from(analyticsJobs)
    .where(
      and(
        eq(analyticsJobs.roundId, roundId),
        inArray(
          analyticsJobs.consultationId,
          consultationRows.map((consultation) => consultation.id)
        )
      )
    )
    .orderBy(asc(analyticsJobs.consultationId), desc(analyticsJobs.createdAt));

  const latestByConsultation = new Map<string, AnalyticsJobRow>();
  for (const row of latestJobs) {
    if (!latestByConsultation.has(row.consultationId)) {
      latestByConsultation.set(row.consultationId, row);
    }
  }

  return consultationRows.map((consultation) => ({
    consultationId: consultation.id,
    jobStatus: latestByConsultation.get(consultation.id)
      ? mapJobRow(latestByConsultation.get(consultation.id) as AnalyticsJobRow)
      : null,
  }));
}

export async function getConsultationAnalyticsData(
  consultationId: string
): Promise<ConsultationAnalytics> {
  const userId = await requireCurrentUserId();
  return getConsultationAnalytics(consultationId, userId);
}

export async function getRoundAnalyticsData(roundId: string): Promise<RoundAnalyticsResponse> {
  const userId = await requireCurrentUserId();
  return getRoundAnalytics(roundId, userId);
}

export async function getConsultationAnalyticsJobStatus(
  consultationId: string
): Promise<AnalyticsJobStatus | null> {
  const userId = await requireCurrentUserId();
  await requireOwnedConsultation(consultationId, userId);

  const latestJob = await getLatestJobForConsultation(consultationId);
  return latestJob ? mapJobRow(latestJob) : null;
}

export async function getRoundAnalyticsJobStatuses(
  roundId: string
): Promise<RoundAnalyticsJobsResponse> {
  const userId = await requireCurrentUserId();
  await requireOwnedRound(roundId, userId);

  return {
    data: await getLatestJobStatusesForRound(roundId),
  };
}

export async function triggerConsultationAnalyticsJob(
  consultationId: string,
  roundId?: string | null
): Promise<AnalyticsJobTriggerResponse> {
  const userId = await requireCurrentUserId();
  const consultation = await requireOwnedConsultation(consultationId, userId);

  if (roundId && consultation.roundId && consultation.roundId !== roundId) {
    throw new Error("Consultation does not belong to the requested round");
  }

  const activeJob = await db
    .select()
    .from(analyticsJobs)
    .where(
      and(
        eq(analyticsJobs.consultationId, consultationId),
        inArray(analyticsJobs.phase, ACTIVE_JOB_PHASES)
      )
    )
    .orderBy(desc(analyticsJobs.createdAt))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (activeJob) {
    return {
      jobId: activeJob.id,
      status: "already_running",
    };
  }

  const [created] = await db.transaction(async (tx) => {
    const [job] = await tx
      .insert(analyticsJobs)
      .values({
        consultationId,
        roundId: roundId ?? consultation.roundId ?? null,
        phase: "queued",
        progress: -1,
      })
      .returning({ id: analyticsJobs.id });

    await insertAnalyticsAuditLog(tx, {
      consultationId,
      userId,
      action: AUDIT_ACTIONS.ANALYTICS_JOB_TRIGGERED,
      entityType: "analytics_job",
      entityId: job.id,
      metadata: {
        consultationId,
        roundId: roundId ?? consultation.roundId ?? null,
        phase: "queued",
      },
    });

    return [job];
  });

  return {
    jobId: created.id,
    status: "queued",
  };
}

export async function triggerRoundAnalyticsJobs(
  roundId: string
): Promise<{ jobCount: number }> {
  const userId = await requireCurrentUserId();
  await requireOwnedRound(roundId, userId);

  const consultationRows = await db
    .select({ id: consultations.id })
    .from(consultations)
    .where(and(eq(consultations.roundId, roundId), eq(consultations.userId, userId)))
    .orderBy(asc(consultations.createdAt));

  let jobCount = 0;

  await db.transaction(async (tx) => {
    for (const consultation of consultationRows) {
      const [activeJob] = await tx
        .select()
        .from(analyticsJobs)
        .where(
          and(
            eq(analyticsJobs.consultationId, consultation.id),
            inArray(analyticsJobs.phase, ACTIVE_JOB_PHASES)
          )
        )
        .orderBy(desc(analyticsJobs.createdAt))
        .limit(1);

      if (activeJob) {
        continue;
      }

      const [created] = await tx
        .insert(analyticsJobs)
        .values({
          consultationId: consultation.id,
          roundId,
          phase: "queued",
          progress: -1,
        })
        .returning({ id: analyticsJobs.id });

      await insertAnalyticsAuditLog(tx, {
        consultationId: consultation.id,
        userId,
        action: AUDIT_ACTIONS.ANALYTICS_JOB_TRIGGERED,
        entityType: "analytics_job",
        entityId: created.id,
        metadata: {
          consultationId: consultation.id,
          roundId,
          phase: "queued",
        },
      });

      jobCount += 1;
    }
  });

  return { jobCount };
}

export async function recordAnalyticsClusterDecision(params: {
  roundId: string;
  clusterId: number;
  action: AnalyticsClusterDecisionAction;
  rationale?: string | null;
  editedLabel?: string | null;
}): Promise<AnalyticsClusterDecisionResponse> {
  const userId = await requireCurrentUserId();
  await requireOwnedRound(params.roundId, userId);

  const [cluster] = await db
    .select()
    .from(termClusters)
    .where(and(eq(termClusters.roundId, params.roundId), eq(termClusters.clusterId, params.clusterId)))
    .limit(1);

  if (!cluster) {
    throw new Error("Cluster not found");
  }

  const rationale = trimToNull(params.rationale);
  const editedLabel = trimToNull(params.editedLabel);

  if (params.action === "reject" && !rationale) {
    throw new Error("A rationale is required when rejecting a cluster suggestion");
  }

  if (params.action === "edit" && !editedLabel) {
    throw new Error("An edited label is required when editing a cluster suggestion");
  }

  let decisionType: "accepted" | "discarded" | "management_rejected" = "accepted";
  let auditAction:
    | typeof AUDIT_ACTIONS.ANALYTICS_CLUSTER_DECISION_ACCEPTED
    | typeof AUDIT_ACTIONS.ANALYTICS_CLUSTER_DECISION_REJECTED
    | typeof AUDIT_ACTIONS.ANALYTICS_CLUSTER_DECISION_EDITED =
    AUDIT_ACTIONS.ANALYTICS_CLUSTER_DECISION_ACCEPTED;

  if (params.action === "reject") {
    decisionType = "management_rejected";
    auditAction = AUDIT_ACTIONS.ANALYTICS_CLUSTER_DECISION_REJECTED;
  } else if (params.action === "edit") {
    decisionType = "accepted";
    auditAction = AUDIT_ACTIONS.ANALYTICS_CLUSTER_DECISION_EDITED;
  }

  const [createdDecision] = await db.transaction(async (tx) => {
    if (params.action === "edit" && editedLabel) {
      await tx
        .update(termClusters)
        .set({ label: editedLabel })
        .where(eq(termClusters.id, cluster.id));
    }

    const [decision] = await tx
      .insert(roundDecisions)
      .values({
        roundId: params.roundId,
        userId,
        targetType: "theme_group" as const,
        targetId: cluster.id,
        decisionType,
        rationale: rationale ?? null,
        metadata: {
          analytics_cluster_id: params.clusterId,
          analytics_cluster_record_id: cluster.id,
          analytics_decision_action: params.action,
          original_label: cluster.label,
          edited_label: editedLabel ?? null,
        },
      })
      .returning();

    await insertAnalyticsAuditLog(tx, {
      consultationId: null,
      userId,
      action: auditAction,
      entityType: "analytics_cluster",
      entityId: cluster.id,
      metadata: {
        roundId: params.roundId,
        clusterId: params.clusterId,
        clusterRecordId: cluster.id,
        decisionType,
        decisionAction: params.action,
        rationale: rationale ?? null,
        editedLabel: editedLabel ?? null,
      },
    });

    return [decision];
  });

  return {
    data: {
      decisionId: createdDecision.id,
      roundId: params.roundId,
      clusterId: params.clusterId,
      clusterRecordId: cluster.id,
      action: params.action,
      decisionType,
      label: params.action === "edit" && editedLabel ? editedLabel : cluster.label,
      editedLabel: editedLabel ?? null,
    },
  };
}

export async function getRoundAnalyticsDataSet(roundId: string): Promise<RoundAnalytics> {
  const userId = await requireCurrentUserId();
  const summary = await getRoundAnalyticsSummary(roundId, userId);

  return {
    roundId,
    clusters: summary.clusters,
    consultationCount: summary.consultationCount,
    processedConsultationCount: summary.processedConsultationCount,
    totalTermCount: summary.totalTermCount,
    lastClusteredAt: summary.latestClusteredAt,
  };
}
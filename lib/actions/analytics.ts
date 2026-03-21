"use server";

import { and, desc, eq, inArray, asc } from "drizzle-orm";
import { db } from "@/db/client";
import {
  analyticsJobs,
  auditLog,
  consultationDecisions,
  meetings,
  termClusters,
} from "@/db/schema";
import { requireCurrentUserId } from "@/lib/data/auth-context";
import {
  requireOwnedMeeting,
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
    consultationId: row.meetingId,
    roundId: row.consultationId ?? null,
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
    meetingId?: string | null;
    userId: string;
    action: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }
) {
  await tx.insert(auditLog).values({
    meetingId: params.meetingId ?? null,
    userId: params.userId,
    action: params.action,
    entityType: params.entityType ?? null,
    entityId: params.entityId ? params.entityId : null,
    payload: params.metadata ?? null,
  });
}

async function getLatestJobForMeeting(meetingId: string) {
  const [row] = await db
    .select()
    .from(analyticsJobs)
    .where(eq(analyticsJobs.meetingId, meetingId))
    .orderBy(desc(analyticsJobs.createdAt))
    .limit(1);

  return row ?? null;
}

async function getLatestJobStatusesForRound(consultationId: string) {
  const meetingRows = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(eq(meetings.consultationId, consultationId))
    .orderBy(asc(meetings.createdAt));

  const latestJobs = await db
    .select()
    .from(analyticsJobs)
    .where(
      and(
        eq(analyticsJobs.consultationId, consultationId),
        inArray(
          analyticsJobs.meetingId,
          meetingRows.map((meeting) => meeting.id)
        )
      )
    )
    .orderBy(asc(analyticsJobs.meetingId), desc(analyticsJobs.createdAt));

  const latestByMeeting = new Map<string, AnalyticsJobRow>();
  for (const row of latestJobs) {
    if (!latestByMeeting.has(row.meetingId)) {
      latestByMeeting.set(row.meetingId, row);
    }
  }

  return meetingRows.map((meeting) => ({
    consultationId: meeting.id,
    jobStatus: latestByMeeting.get(meeting.id)
      ? mapJobRow(latestByMeeting.get(meeting.id) as AnalyticsJobRow)
      : null,
  }));
}

export async function getConsultationAnalyticsData(
  meetingId: string
): Promise<ConsultationAnalytics> {
  const userId = await requireCurrentUserId();
  return getConsultationAnalytics(meetingId, userId);
}

export async function getRoundAnalyticsData(consultationId: string): Promise<RoundAnalyticsResponse> {
  const userId = await requireCurrentUserId();
  return getRoundAnalytics(consultationId, userId);
}

export async function getConsultationAnalyticsJobStatus(
  meetingId: string
): Promise<AnalyticsJobStatus | null> {
  const userId = await requireCurrentUserId();
  await requireOwnedMeeting(meetingId, userId);

  const latestJob = await getLatestJobForMeeting(meetingId);
  return latestJob ? mapJobRow(latestJob) : null;
}

export async function getRoundAnalyticsJobStatuses(
  consultationId: string
): Promise<RoundAnalyticsJobsResponse> {
  const userId = await requireCurrentUserId();
  await requireOwnedRound(consultationId, userId);

  return {
    data: await getLatestJobStatusesForRound(consultationId),
  };
}

export async function triggerConsultationAnalyticsJob(
  meetingId: string,
  consultationId?: string | null
): Promise<AnalyticsJobTriggerResponse> {
  const userId = await requireCurrentUserId();
  const meeting = await requireOwnedMeeting(meetingId, userId);

  if (consultationId && meeting.consultationId && meeting.consultationId !== consultationId) {
    throw new Error("Meeting does not belong to the requested consultation");
  }

  const activeJob = await db
    .select()
    .from(analyticsJobs)
    .where(
      and(
        eq(analyticsJobs.meetingId, meetingId),
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
        meetingId,
        consultationId: consultationId ?? meeting.consultationId ?? null,
        phase: "queued",
        progress: -1,
      })
      .returning({ id: analyticsJobs.id });

    await insertAnalyticsAuditLog(tx, {
      meetingId,
      userId,
      action: AUDIT_ACTIONS.ANALYTICS_JOB_TRIGGERED,
      entityType: "analytics_job",
      entityId: job.id,
      metadata: {
        meetingId,
        consultationId: consultationId ?? meeting.consultationId ?? null,
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
  consultationId: string
): Promise<{ jobCount: number }> {
  const userId = await requireCurrentUserId();
  await requireOwnedRound(consultationId, userId);

  const meetingRows = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(and(eq(meetings.consultationId, consultationId), eq(meetings.userId, userId)))
    .orderBy(asc(meetings.createdAt));

  let jobCount = 0;

  await db.transaction(async (tx) => {
    for (const meeting of meetingRows) {
      const [activeJob] = await tx
        .select()
        .from(analyticsJobs)
        .where(
          and(
            eq(analyticsJobs.meetingId, meeting.id),
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
          meetingId: meeting.id,
          consultationId,
          phase: "queued",
          progress: -1,
        })
        .returning({ id: analyticsJobs.id });

      await insertAnalyticsAuditLog(tx, {
        meetingId: meeting.id,
        userId,
        action: AUDIT_ACTIONS.ANALYTICS_JOB_TRIGGERED,
        entityType: "analytics_job",
        entityId: created.id,
        metadata: {
          meetingId: meeting.id,
          consultationId,
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
    .where(and(eq(termClusters.consultationId, params.roundId), eq(termClusters.clusterId, params.clusterId)))
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
      .insert(consultationDecisions)
      .values({
        consultationId: params.roundId,
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
      meetingId: null,
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

export async function getRoundAnalyticsDataSet(consultationId: string): Promise<RoundAnalytics> {
  const userId = await requireCurrentUserId();
  const summary = await getRoundAnalyticsSummary(consultationId, userId);

  return {
    roundId: consultationId,
    clusters: summary.clusters,
    consultationCount: summary.consultationCount,
    processedConsultationCount: summary.processedConsultationCount,
    totalTermCount: summary.totalTermCount,
    lastClusteredAt: summary.latestClusteredAt,
  };
}

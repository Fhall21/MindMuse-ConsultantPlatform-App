import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  analyticsJobs,
  consultations,
  extractionResults,
  termClusterMemberships,
  termClusters,
  termExtractionOffsets,
} from "@/db/schema";
import type {
  AnalyticsJobPhase,
  AnalyticsJobStatus,
  ConsultationAnalytics,
  ExtractionResult,
  RoundAnalytics,
  RoundAnalyticsResponse,
  TermCluster,
  TermClusterMembership,
  TermExtraction,
} from "@/types/analytics";
import { requireOwnedConsultation, requireOwnedRound } from "./ownership";

type AnalyticsJobRow = typeof analyticsJobs.$inferSelect;
type ConsultationRow = typeof consultations.$inferSelect;
type ExtractionResultRow = typeof extractionResults.$inferSelect;
type TermExtractionOffsetRow = typeof termExtractionOffsets.$inferSelect;
type TermClusterRow = typeof termClusters.$inferSelect;
type TermClusterMembershipRow = typeof termClusterMemberships.$inferSelect;

const ACTIVE_JOB_PHASES = new Set<AnalyticsJobPhase>([
  "queued",
  "extracting",
  "embedding",
  "clustering",
  "syncing",
]);

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return value.toISOString();
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
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

function mapExtractionTermRow(row: TermExtractionOffsetRow): TermExtraction {
  return {
    term: row.term,
    charStart: row.charStart,
    charEnd: row.charEnd,
    entityType: row.entityType,
    confidence: toNumber(row.confidence),
    sourceSpan: row.sourceSpan,
  };
}

function mapExtractionResultRow(
  row: ExtractionResultRow,
  offsets: TermExtractionOffsetRow[]
): ExtractionResult {
  const resultTerms = offsets
    .filter((offset) => offset.extractionResultId === row.id)
    .sort((left, right) => left.charStart - right.charStart)
    .map(mapExtractionTermRow);

  return {
    consultationId: row.consultationId,
    extractedAt: toIsoString(row.extractedAt) ?? new Date().toISOString(),
    terms: resultTerms,
    metadata: {
      extractor: row.extractor,
      modelVersion: row.modelVersion,
      transcriptWordCount: row.transcriptWordCount,
      durationMs: row.durationMs,
    },
  };
}

function mapClusterRow(row: TermClusterRow): TermCluster {
  return {
    clusterId: row.clusterId,
    label: row.label,
    representativeTerms: toStringArray(row.representativeTerms),
    allTerms: toStringArray(row.allTerms),
    consultationCount: row.consultationCount,
  };
}

function mapMembershipRow(row: TermClusterMembershipRow): TermClusterMembership {
  return {
    consultationId: row.consultationId,
    term: row.term,
    clusterId: row.clusterId,
    membershipProbability: toNumber(row.membershipProbability),
  };
}

function latestRow<T extends { consultationId: string; createdAt: Date }>(rows: T[]) {
  const latestByConsultation = new Map<string, T>();

  for (const row of rows) {
    const current = latestByConsultation.get(row.consultationId);
    if (!current || row.createdAt > current.createdAt) {
      latestByConsultation.set(row.consultationId, row);
    }
  }

  return latestByConsultation;
}

function maxIsoDate(values: Array<Date | string | null | undefined>): string | null {
  let latest: Date | null = null;

  for (const value of values) {
    if (!value) {
      continue;
    }

    const candidate = typeof value === "string" ? new Date(value) : value;
    if (!latest || candidate > latest) {
      latest = candidate;
    }
  }

  return latest ? latest.toISOString() : null;
}

export interface RoundAnalyticsSummary {
  consultationCount: number;
  processedConsultationCount: number;
  failedConsultationCount: number;
  activeConsultationCount: number;
  totalTermCount: number;
  clusterCount: number;
  outlierTermCount: number;
  averageExtractionConfidence: number | null;
  latestExtractionAt: string | null;
  latestClusteredAt: string | null;
  latestJobStatus: AnalyticsJobStatus | null;
  clusters: TermCluster[];
}

interface BuildRoundAnalyticsParams {
  consultationIds: string[];
  jobRows: AnalyticsJobRow[];
  extractionRows: ExtractionResultRow[];
  offsetRows: TermExtractionOffsetRow[];
  clusterRows: TermClusterRow[];
  membershipRows: TermClusterMembershipRow[];
}

export function buildRoundAnalyticsSummary({
  consultationIds,
  jobRows,
  extractionRows,
  offsetRows,
  clusterRows,
  membershipRows,
}: BuildRoundAnalyticsParams): RoundAnalyticsSummary {
  const latestJobsByConsultation = latestRow(jobRows);
  const latestExtractionByConsultation = latestRow(extractionRows);

  const latestExtractionResultIds = new Set(
    Array.from(latestExtractionByConsultation.values()).map((row) => row.id)
  );

  const latestOffsets = offsetRows.filter((row) => latestExtractionResultIds.has(row.extractionResultId));
  const latestJobRow = [...jobRows].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
  )[0] ?? null;

  let completedConsultationCount = 0;
  let failedConsultationCount = 0;
  let activeConsultationCount = 0;

  for (const job of latestJobsByConsultation.values()) {
    if (job.phase === "complete") {
      completedConsultationCount += 1;
    } else if (job.phase === "failed") {
      failedConsultationCount += 1;
    } else if (ACTIVE_JOB_PHASES.has(job.phase)) {
      activeConsultationCount += 1;
    }
  }

  const extractionConfidenceValues = Array.from(latestExtractionByConsultation.values()).map((row) =>
    toNumber(row.confidence)
  );
  const averageExtractionConfidence =
    extractionConfidenceValues.length > 0
      ? Number(
          (
            extractionConfidenceValues.reduce((sum, value) => sum + value, 0) /
            extractionConfidenceValues.length
          ).toFixed(3)
        )
      : null;

  return {
    consultationCount: consultationIds.length,
    processedConsultationCount: completedConsultationCount,
    failedConsultationCount,
    activeConsultationCount,
    totalTermCount: latestOffsets.length,
    clusterCount: clusterRows.length,
    outlierTermCount: membershipRows.filter((row) => row.clusterId === -1).length,
    averageExtractionConfidence,
    latestExtractionAt: maxIsoDate(Array.from(latestExtractionByConsultation.values()).map((row) => row.extractedAt)),
    latestClusteredAt: maxIsoDate(clusterRows.map((row) => row.clusteredAt)),
    latestJobStatus: latestJobRow ? mapJobRow(latestJobRow) : null,
    clusters: clusterRows.map(mapClusterRow),
  };
}

interface LoadRoundAnalyticsSummaryParams {
  roundId: string;
  consultationIds: string[];
}

export async function loadRoundAnalyticsSummary({
  roundId,
  consultationIds,
}: LoadRoundAnalyticsSummaryParams): Promise<RoundAnalyticsSummary> {
  if (consultationIds.length === 0) {
    return {
      consultationCount: 0,
      processedConsultationCount: 0,
      failedConsultationCount: 0,
      activeConsultationCount: 0,
      totalTermCount: 0,
      clusterCount: 0,
      outlierTermCount: 0,
      averageExtractionConfidence: null,
      latestExtractionAt: null,
      latestClusteredAt: null,
      latestJobStatus: null,
      clusters: [],
    };
  }

  const [jobRows, extractionRows, clusterRows, membershipRows] = await Promise.all([
    db
      .select()
      .from(analyticsJobs)
      .where(
        and(
          eq(analyticsJobs.roundId, roundId),
          inArray(analyticsJobs.consultationId, consultationIds)
        )
      )
      .orderBy(asc(analyticsJobs.consultationId), desc(analyticsJobs.createdAt)),
    db
      .select()
      .from(extractionResults)
      .where(
        and(
          eq(extractionResults.roundId, roundId),
          inArray(extractionResults.consultationId, consultationIds)
        )
      )
      .orderBy(asc(extractionResults.consultationId), desc(extractionResults.extractedAt)),
    db
      .select()
      .from(termClusters)
      .where(eq(termClusters.roundId, roundId))
      .orderBy(desc(termClusters.clusteredAt)),
    db
      .select()
      .from(termClusterMemberships)
      .where(eq(termClusterMemberships.roundId, roundId))
      .orderBy(
        asc(termClusterMemberships.consultationId),
        asc(termClusterMemberships.clusterId),
        asc(termClusterMemberships.term)
      ),
  ]);

  const latestExtractionByConsultation = latestRow(extractionRows);
  const latestExtractionResultIds = new Set(
    Array.from(latestExtractionByConsultation.values()).map((row) => row.id)
  );
  const offsetRows = latestExtractionResultIds.size === 0
    ? []
    : ((await db
        .select()
        .from(termExtractionOffsets)
        .where(inArray(termExtractionOffsets.extractionResultId, Array.from(latestExtractionResultIds)))
        .orderBy(asc(termExtractionOffsets.consultationId), asc(termExtractionOffsets.charStart))) as TermExtractionOffsetRow[]);

  return buildRoundAnalyticsSummary({
    consultationIds,
    jobRows,
    extractionRows,
    offsetRows,
    clusterRows,
    membershipRows,
  });
}

export async function getRoundAnalyticsSummary(
  roundId: string,
  userId: string
): Promise<RoundAnalyticsSummary> {
  await requireOwnedRound(roundId, userId);

  const consultationsForRound = (await db
    .select({ id: consultations.id })
    .from(consultations)
    .where(and(eq(consultations.roundId, roundId), eq(consultations.userId, userId)))
    .orderBy(asc(consultations.createdAt))) as Array<Pick<ConsultationRow, "id">>;

  return loadRoundAnalyticsSummary({
    roundId,
    consultationIds: consultationsForRound.map((consultation) => consultation.id),
  });
}

export async function getConsultationAnalytics(
  consultationId: string,
  userId: string
): Promise<ConsultationAnalytics> {
  await requireOwnedConsultation(consultationId, userId);

  const [jobRows, extractionRows, membershipRows] = await Promise.all([
    db
      .select()
      .from(analyticsJobs)
      .where(eq(analyticsJobs.consultationId, consultationId))
      .orderBy(desc(analyticsJobs.createdAt)),
    db
      .select()
      .from(extractionResults)
      .where(eq(extractionResults.consultationId, consultationId))
      .orderBy(desc(extractionResults.extractedAt)),
    db
      .select()
      .from(termClusterMemberships)
      .where(eq(termClusterMemberships.consultationId, consultationId))
      .orderBy(asc(termClusterMemberships.clusterId), asc(termClusterMemberships.term)),
  ]);

  const latestJobRow = jobRows[0] ?? null;
  const hasBeenProcessed = jobRows.some((row) => row.phase === "complete");
  const latestExtractionRow = extractionRows[0] ?? null;

  let extraction: ExtractionResult | null = null;
  if (latestExtractionRow) {
    const offsets = (await db
      .select()
      .from(termExtractionOffsets)
      .where(eq(termExtractionOffsets.extractionResultId, latestExtractionRow.id))
      .orderBy(asc(termExtractionOffsets.charStart))) as TermExtractionOffsetRow[];

    extraction = mapExtractionResultRow(latestExtractionRow, offsets);
  }

  return {
    consultationId,
    jobStatus: latestJobRow ? mapJobRow(latestJobRow) : null,
    extraction,
    clusterMemberships: membershipRows.map(mapMembershipRow),
    hasBeenProcessed,
  };
}

export async function getRoundAnalytics(
  roundId: string,
  userId: string
): Promise<RoundAnalyticsResponse> {
  const summary = await getRoundAnalyticsSummary(roundId, userId);

  return {
    data: {
      roundId,
      clusters: summary.clusters,
      consultationCount: summary.consultationCount,
      processedConsultationCount: summary.processedConsultationCount,
      totalTermCount: summary.totalTermCount,
      lastClusteredAt: summary.latestClusteredAt,
    } satisfies RoundAnalytics,
  };
}
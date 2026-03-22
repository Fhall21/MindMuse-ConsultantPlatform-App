/**
 * Stage 7 Analytics Layer — Shared Data Contracts
 *
 * Owned by: Agent 1 (Product & UI)
 * Consumed by:
 *   Agent 2 (Extraction Pipeline)   — produces ExtractionResult
 *   Agent 3 (Embeddings/Clustering) — produces TermCluster*, TermClusterMembership
 *   Agent 4 (DB Sync)               — persists all types below into Postgres + Neo4j
 *   Agent 5 (Celery/API)            — returns AnalyticsJobStatus, triggers jobs
 *   Agent 6 (Compliance/Testing)    — audits ExtractionResult erasure cascades
 *
 * Breaking change policy: bump the CONTRACT_VERSION below and add a migration note.
 */

export const ANALYTICS_CONTRACT_VERSION = "1.0.0" as const;

// ─── Extraction ──────────────────────────────────────────────────────────────

/**
 * A single term extracted from a consultation transcript.
 * The charStart/charEnd offsets refer to `consultations.transcript_raw`.
 * Explainability requirement: every term MUST carry exact char offsets.
 */
export interface TermExtraction {
  /** Canonical (normalised) form of the extracted term. */
  term: string;
  /** Start character offset in transcript_raw (inclusive). */
  charStart: number;
  /** End character offset in transcript_raw (exclusive). */
  charEnd: number;
  /**
   * Entity type. langextract handles THEME/ISSUE; spaCy handles
   * PERSON/ORG/LOCATION/DATE. Combined runs merge both.
   */
  entityType: TermEntityType;
  /** Extraction confidence in [0, 1]. */
  confidence: number;
  /**
   * The verbatim substring transcript_raw[charStart:charEnd].
   * Stored for audit; do not reconstruct from offsets alone after any
   * transcript edit.
   */
  sourceSpan: string;
}

export type TermEntityType =
  | "THEME"
  | "ISSUE"
  | "PERSON"
  | "ORG"
  | "LOCATION"
  | "DATE"
  | "OTHER";

export interface ExtractionMetadata {
  /** Which extractor(s) produced this result. */
  extractor: "langextract" | "spacy" | "combined";
  /** Version string of the model/pipeline (e.g. "langextract-0.3.1"). */
  modelVersion: string;
  /** Word count of the transcript at extraction time. */
  transcriptWordCount: number;
  /** Wall-clock duration of the extraction run in milliseconds. */
  durationMs: number;
}

export interface ExtractionResult {
  consultationId: string;
  /** ISO 8601 timestamp of when this extraction was produced. */
  extractedAt: string;
  terms: TermExtraction[];
  metadata: ExtractionMetadata;
}

// ─── Analytics Job ────────────────────────────────────────────────────────────

export type AnalyticsJobPhase =
  | "queued"
  | "extracting"
  | "embedding"
  | "clustering"
  | "syncing"
  | "complete"
  | "failed";

export interface AnalyticsJobStatus {
  jobId: string;
  consultationId: string;
  /** Present when the job was triggered as part of a round-level batch. */
  roundId: string | null;
  phase: AnalyticsJobPhase;
  /**
   * Progress percentage in [0, 100].
   * Use -1 to indicate an indeterminate phase (e.g. "queued").
   */
  progress: number;
  /** ISO 8601. Null if the job has not yet started. */
  startedAt: string | null;
  /** ISO 8601. Null if the job has not yet finished. */
  completedAt: string | null;
  /** Human-readable error. Only populated when phase === "failed". */
  errorMessage: string | null;
}

// ─── Clustering (HDBSCAN) ─────────────────────────────────────────────────────

export interface TermClusterMembership {
  /** Matches TermExtraction.term (canonical form). */
  term: string;
  consultationId: string;
  /**
   * HDBSCAN cluster ID.
   * -1 means the term was classified as noise (no cluster).
   */
  clusterId: number;
  /** Soft-assignment probability in [0, 1] from HDBSCAN. */
  membershipProbability: number;
}

export interface TermCluster {
  clusterId: number;
  /**
   * Human-readable label auto-derived from the cluster's representative
   * terms. May be edited by the consultant (Agent 3 produces; UI may update).
   */
  label: string;
  /** Top terms by TF-IDF weight within the cluster (≤ 5). */
  representativeTerms: string[];
  /** All canonical terms belonging to this cluster. */
  allTerms: string[];
  /** Number of distinct meetings that contributed terms to this cluster. */
  meetingCount: number;
}

// ─── UI-facing aggregates ─────────────────────────────────────────────────────

/**
 * Complete analytics state for a single consultation.
 * Returned by GET /api/analytics/consultations/[id].
 */
export interface ConsultationAnalytics {
  consultationId: string;
  /** Null if no job has ever been triggered. */
  jobStatus: AnalyticsJobStatus | null;
  /** Null until a job completes successfully. */
  extraction: ExtractionResult | null;
  /** Cluster memberships for this consultation's extracted terms. */
  clusterMemberships: TermClusterMembership[];
  /** True if at least one completed job exists for this consultation. */
  hasBeenProcessed: boolean;
}

/**
 * Cross-consultation analytics summary for a round.
 * Returned by GET /api/analytics/rounds/[id].
 */
export interface RoundAnalytics {
  roundId: string;
  /** HDBSCAN clusters derived from all processed consultations in the round. */
  clusters: TermCluster[];
  /** Total consultations in the round. */
  consultationCount: number;
  /** Consultations that have completed analytics jobs. */
  processedConsultationCount: number;
  totalTermCount: number;
  /** ISO 8601. Null if no clustering run has completed. */
  lastClusteredAt: string | null;
}

// ─── API shapes (TanStack Query hook contracts) ───────────────────────────────

export interface AnalyticsJobTriggerRequest {
  consultationId: string;
  /** Provide to associate the job with a round-level batch run. */
  roundId?: string;
}

export interface AnalyticsJobTriggerResponse {
  jobId: string;
  /** "queued" on success; "already_running" if a job is already in progress. */
  status: "queued" | "already_running";
}

export interface AnalyticsJobStatusResponse {
  data: AnalyticsJobStatus | null;
}

export interface RoundAnalyticsJobsResponse {
  data: Array<{
    consultationId: string;
    jobStatus: AnalyticsJobStatus | null;
  }>;
}

export interface ConsultationAnalyticsResponse {
  data: ConsultationAnalytics;
}

export type AnalyticsClusterDecisionAction = "accept" | "reject" | "edit";

export interface AnalyticsClusterDecisionRequest {
  action: AnalyticsClusterDecisionAction;
  rationale?: string;
  editedLabel?: string;
}

export interface AnalyticsClusterDecisionResponse {
  data: {
    decisionId: string;
    roundId: string;
    clusterId: number;
    clusterRecordId: string;
    action: AnalyticsClusterDecisionAction;
    decisionType: "accepted" | "discarded" | "management_rejected";
    label: string;
    editedLabel: string | null;
  };
}

/** Response from POST /api/analytics/rounds/[id]/jobs */
export interface RoundAnalyticsJobTriggerResponse {
  /** Number of per-consultation jobs enqueued. */
  jobCount: number;
}

export interface RoundAnalyticsResponse {
  data: RoundAnalytics;
}

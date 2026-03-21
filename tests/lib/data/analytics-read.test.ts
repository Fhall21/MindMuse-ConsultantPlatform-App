import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({
  db: {},
}));

import { buildRoundAnalyticsSummary } from "@/lib/data/analytics-read";

function buildInput(overrides: Partial<Parameters<typeof buildRoundAnalyticsSummary>[0]> = {}) {
  return {
    meetingIds: [],
    jobRows: [],
    extractionRows: [],
    offsetRows: [],
    clusterRows: [],
    membershipRows: [],
    ...overrides,
  } as Parameters<typeof buildRoundAnalyticsSummary>[0];
}

describe("lib/data/analytics-read", () => {
  it("returns an empty summary when no analytics have run", () => {
    const summary = buildRoundAnalyticsSummary(buildInput());

    expect(summary).toEqual({
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
    });
  });

  it("counts latest job states per consultation and keeps the newest job status", () => {
    const summary = buildRoundAnalyticsSummary(
      buildInput({
        meetingIds: ["consultation-1", "consultation-2", "consultation-3"],
        jobRows: [
          {
            id: "job-1",
            meetingId: "consultation-1",
            consultationId: "round-1",
            phase: "queued",
            progress: -1,
            startedAt: null,
            completedAt: null,
            errorMessage: null,
            createdAt: new Date("2026-03-19T10:00:00.000Z"),
            updatedAt: new Date("2026-03-19T10:00:00.000Z"),
          },
          {
            id: "job-2",
            meetingId: "consultation-1",
            consultationId: "round-1",
            phase: "complete",
            progress: 100,
            startedAt: new Date("2026-03-19T10:05:00.000Z"),
            completedAt: new Date("2026-03-19T10:06:00.000Z"),
            errorMessage: null,
            createdAt: new Date("2026-03-19T10:06:00.000Z"),
            updatedAt: new Date("2026-03-19T10:06:00.000Z"),
          },
          {
            id: "job-3",
            meetingId: "consultation-2",
            consultationId: "round-1",
            phase: "failed",
            progress: 100,
            startedAt: new Date("2026-03-19T11:00:00.000Z"),
            completedAt: new Date("2026-03-19T11:02:00.000Z"),
            errorMessage: "Embedding failed",
            createdAt: new Date("2026-03-19T11:02:00.000Z"),
            updatedAt: new Date("2026-03-19T11:02:00.000Z"),
          },
          {
            id: "job-4",
            meetingId: "consultation-3",
            consultationId: "round-1",
            phase: "extracting",
            progress: 22,
            startedAt: new Date("2026-03-19T12:00:00.000Z"),
            completedAt: null,
            errorMessage: null,
            createdAt: new Date("2026-03-19T12:01:00.000Z"),
            updatedAt: new Date("2026-03-19T12:01:00.000Z"),
          },
        ] as never,
      })
    );

    expect(summary.processedConsultationCount).toBe(1);
    expect(summary.failedConsultationCount).toBe(1);
    expect(summary.activeConsultationCount).toBe(1);
    expect(summary.latestJobStatus?.consultationId).toBe("consultation-3");
    expect(summary.latestJobStatus?.phase).toBe("extracting");
  });

  it("keeps outliers explicit and counts clustered terms separately", () => {
    const summary = buildRoundAnalyticsSummary(
      buildInput({
        meetingIds: ["consultation-1", "consultation-2"],
        extractionRows: [
          {
            id: "extraction-1",
            meetingId: "consultation-1",
            consultationId: "round-1",
            extractedAt: new Date("2026-03-19T10:00:00.000Z"),
            extractor: "langextract",
            modelVersion: "1.0.0",
            transcriptWordCount: 220,
            durationMs: 1500,
            confidence: 0.92,
            fallbackUsed: false,
            reducedRecall: false,
            errorMessages: [],
            resultJson: {},
            createdAt: new Date("2026-03-19T10:00:00.000Z"),
          },
          {
            id: "extraction-2",
            meetingId: "consultation-2",
            consultationId: "round-1",
            extractedAt: new Date("2026-03-19T11:00:00.000Z"),
            extractor: "spacy",
            modelVersion: "1.0.0",
            transcriptWordCount: 180,
            durationMs: 400,
            confidence: 0.81,
            fallbackUsed: true,
            reducedRecall: true,
            errorMessages: [],
            resultJson: {},
            createdAt: new Date("2026-03-19T11:00:00.000Z"),
          },
        ] as never,
        offsetRows: [
          {
            id: "offset-1",
            extractionResultId: "extraction-1",
            meetingId: "consultation-1",
            term: "workload",
            original: "workload",
            entityType: "THEME",
            confidence: 0.92,
            charStart: 10,
            charEnd: 18,
            sourceSpan: "workload",
            extractionSource: "langextract",
            posTags: [],
            negationContext: false,
            createdAt: new Date("2026-03-19T10:00:01.000Z"),
          },
          {
            id: "offset-2",
            extractionResultId: "extraction-2",
            meetingId: "consultation-2",
            term: "escalation",
            original: "escalation",
            entityType: "ISSUE",
            confidence: 0.81,
            charStart: 30,
            charEnd: 40,
            sourceSpan: "escalation",
            extractionSource: "spacy",
            posTags: [],
            negationContext: false,
            createdAt: new Date("2026-03-19T11:00:01.000Z"),
          },
        ] as never,
        clusterRows: [
          {
            id: "cluster-1",
            consultationId: "round-1",
            clusterId: 1,
            label: "Workload and escalation",
            representativeTerms: ["workload", "escalation"],
            allTerms: ["workload", "escalation"],
            meetingCount: 2,
            clusteredAt: new Date("2026-03-19T12:00:00.000Z"),
            createdAt: new Date("2026-03-19T12:00:00.000Z"),
          },
        ] as never,
        membershipRows: [
          {
            id: "membership-1",
            consultationId: "round-1",
            meetingId: "consultation-1",
            term: "workload",
            clusterId: 1,
            membershipProbability: 0.94,
            createdAt: new Date("2026-03-19T12:00:01.000Z"),
          },
          {
            id: "membership-2",
            consultationId: "round-1",
            meetingId: "consultation-2",
            term: "escalation",
            clusterId: -1,
            membershipProbability: 0.12,
            createdAt: new Date("2026-03-19T12:00:02.000Z"),
          },
        ] as never,
      })
    );

    expect(summary.totalTermCount).toBe(2);
    expect(summary.clusterCount).toBe(1);
    expect(summary.outlierTermCount).toBe(1);
    expect(summary.latestClusteredAt).toBe("2026-03-19T12:00:00.000Z");
    expect(summary.latestExtractionAt).toBe("2026-03-19T11:00:00.000Z");
    expect(summary.clusters[0]?.representativeTerms).toEqual(["workload", "escalation"]);
  });

  it("treats empty extraction offsets as an explicit no-term condition", () => {
    const summary = buildRoundAnalyticsSummary(
      buildInput({
        meetingIds: ["consultation-1"],
        extractionRows: [
          {
            id: "extraction-1",
            meetingId: "consultation-1",
            consultationId: "round-1",
            extractedAt: new Date("2026-03-19T10:00:00.000Z"),
            extractor: "combined",
            modelVersion: "1.0.0",
            transcriptWordCount: 120,
            durationMs: 800,
            confidence: 0.64,
            fallbackUsed: false,
            reducedRecall: false,
            errorMessages: [],
            resultJson: {},
            createdAt: new Date("2026-03-19T10:00:00.000Z"),
          },
        ] as never,
        clusterRows: [
          {
            id: "cluster-1",
            consultationId: "round-1",
            clusterId: 7,
            label: "Operational pressure",
            representativeTerms: [],
            allTerms: [],
            meetingCount: 1,
            clusteredAt: new Date("2026-03-19T10:30:00.000Z"),
            createdAt: new Date("2026-03-19T10:30:00.000Z"),
          },
        ] as never,
      })
    );

    expect(summary.totalTermCount).toBe(0);
    expect(summary.averageExtractionConfidence).toBe(0.64);
    expect(summary.latestExtractionAt).toBe("2026-03-19T10:00:00.000Z");
  });

  it("aggregates confidence values with numeric precision preserved", () => {
    const summary = buildRoundAnalyticsSummary(
      buildInput({
        meetingIds: ["consultation-1", "consultation-2"],
        extractionRows: [
          {
            id: "extraction-1",
            meetingId: "consultation-1",
            consultationId: "round-1",
            extractedAt: new Date("2026-03-19T10:00:00.000Z"),
            extractor: "langextract",
            modelVersion: "1.0.0",
            transcriptWordCount: 220,
            durationMs: 1500,
            confidence: "0.333",
            fallbackUsed: false,
            reducedRecall: false,
            errorMessages: [],
            resultJson: {},
            createdAt: new Date("2026-03-19T10:00:00.000Z"),
          },
          {
            id: "extraction-2",
            meetingId: "consultation-2",
            consultationId: "round-1",
            extractedAt: new Date("2026-03-19T10:05:00.000Z"),
            extractor: "spacy",
            modelVersion: "1.0.0",
            transcriptWordCount: 210,
            durationMs: 600,
            confidence: 0.667,
            fallbackUsed: true,
            reducedRecall: false,
            errorMessages: [],
            resultJson: {},
            createdAt: new Date("2026-03-19T10:05:00.000Z"),
          },
        ] as never,
      })
    );

    expect(summary.averageExtractionConfidence).toBe(0.5);
  });
});
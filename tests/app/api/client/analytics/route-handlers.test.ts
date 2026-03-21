import { beforeEach, describe, expect, it, vi } from "vitest";

const analyticsActionMocks = vi.hoisted(() => ({
  getConsultationAnalyticsData: vi.fn(),
  getConsultationAnalyticsJobStatus: vi.fn(),
  triggerConsultationAnalyticsJob: vi.fn(),
  getRoundAnalyticsDataSet: vi.fn(),
  getRoundAnalyticsJobStatuses: vi.fn(),
  triggerRoundAnalyticsJobs: vi.fn(),
  recordAnalyticsClusterDecision: vi.fn(),
}));

const authContextMock = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
}));

vi.mock("@/lib/actions/analytics", () => analyticsActionMocks);
vi.mock("@/lib/data/auth-context", () => authContextMock);

import { GET as GETConsultationAnalytics } from "@/app/api/client/analytics/consultations/[id]/route";
import {
  GET as GETConsultationAnalyticsJobStatus,
  POST as POSTConsultationAnalyticsJob,
} from "@/app/api/client/analytics/consultations/[id]/jobs/route";
import { GET as GETRoundAnalytics } from "@/app/api/client/analytics/rounds/[roundId]/route";
import {
  GET as GETRoundAnalyticsJobs,
  POST as POSTRoundAnalyticsJobs,
} from "@/app/api/client/analytics/rounds/[roundId]/jobs/route";
import { POST as POSTClusterDecision } from "@/app/api/client/analytics/rounds/[roundId]/clusters/[clusterId]/decision/route";

function jsonRequest(url: string, body?: unknown) {
  return new Request(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe("analytics routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authContextMock.getCurrentUserId.mockResolvedValue("user-1");
  });

  it("returns consultation analytics", async () => {
    analyticsActionMocks.getConsultationAnalyticsData.mockResolvedValue({
      consultationId: "consultation-1",
      jobStatus: null,
      extraction: null,
      clusterMemberships: [],
      hasBeenProcessed: false,
    });

    const response = await GETConsultationAnalytics(jsonRequest("http://test"), {
      params: Promise.resolve({ id: "consultation-1" }),
    });

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({
      data: {
        consultationId: "consultation-1",
        jobStatus: null,
        extraction: null,
        clusterMemberships: [],
        hasBeenProcessed: false,
      },
    });
  });

  it("blocks consultation analytics job reads when unauthenticated", async () => {
    authContextMock.getCurrentUserId.mockResolvedValue(null);

    const response = await GETConsultationAnalyticsJobStatus(jsonRequest("http://test"), {
      params: Promise.resolve({ id: "consultation-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("rejects malformed consultation analytics job payloads", async () => {
    const response = await POSTConsultationAnalyticsJob(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
      { params: Promise.resolve({ id: "consultation-1" }) }
    );

    expect(response.status).toBe(422);
    await expect(readJson(response)).resolves.toMatchObject({ detail: "Invalid JSON payload" });
  });

  it("queues a consultation analytics job", async () => {
    analyticsActionMocks.triggerConsultationAnalyticsJob.mockResolvedValue({
      jobId: "job-1",
      status: "queued",
    });

    const response = await POSTConsultationAnalyticsJob(
      jsonRequest("http://test", { roundId: "round-1" }),
      { params: Promise.resolve({ id: "consultation-1" }) }
    );

    expect(response.status).toBe(201);
    expect(analyticsActionMocks.triggerConsultationAnalyticsJob).toHaveBeenCalledWith(
      "consultation-1",
      "round-1"
    );
  });

  it("returns round analytics", async () => {
    analyticsActionMocks.getRoundAnalyticsDataSet.mockResolvedValue({
      roundId: "round-1",
      clusters: [],
      consultationCount: 1,
      processedConsultationCount: 1,
      totalTermCount: 0,
      lastClusteredAt: null,
    });

    const response = await GETRoundAnalytics(jsonRequest("http://test"), {
      params: Promise.resolve({ roundId: "round-1" }),
    });

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({
      data: {
        roundId: "round-1",
        clusters: [],
        consultationCount: 1,
        processedConsultationCount: 1,
        totalTermCount: 0,
        lastClusteredAt: null,
      },
    });
  });

  it("queues round analytics jobs", async () => {
    analyticsActionMocks.triggerRoundAnalyticsJobs.mockResolvedValue({ jobCount: 2 });

    const response = await POSTRoundAnalyticsJobs(jsonRequest("http://test"), {
      params: Promise.resolve({ roundId: "round-1" }),
    });

    expect(response.status).toBe(201);
    await expect(readJson(response)).resolves.toEqual({ jobCount: 2 });
  });

  it("returns round analytics job statuses", async () => {
    analyticsActionMocks.getRoundAnalyticsJobStatuses.mockResolvedValue({
      data: [
        {
          consultationId: "consultation-1",
          jobStatus: null,
        },
      ],
    });

    const response = await GETRoundAnalyticsJobs(jsonRequest("http://test"), {
      params: Promise.resolve({ roundId: "round-1" }),
    });

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({
      data: [
        {
          consultationId: "consultation-1",
          jobStatus: null,
        },
      ],
    });
  });

  it("records an analytics cluster accept decision", async () => {
    analyticsActionMocks.recordAnalyticsClusterDecision.mockResolvedValue({
      data: {
        decisionId: "decision-1",
        roundId: "round-1",
        clusterId: 7,
        clusterRecordId: "cluster-row-1",
        action: "accept",
        decisionType: "accepted",
        label: "Workload",
        editedLabel: null,
      },
    });

    const response = await POSTClusterDecision(
      jsonRequest("http://test", { action: "accept" }),
      { params: Promise.resolve({ roundId: "round-1", clusterId: "7" }) }
    );

    expect(response.status).toBe(201);
    expect(analyticsActionMocks.recordAnalyticsClusterDecision).toHaveBeenCalledWith({
      roundId: "round-1",
      clusterId: 7,
      action: "accept",
      rationale: undefined,
      editedLabel: undefined,
    });
  });

  it("rejects invalid analytics cluster identifiers", async () => {
    const response = await POSTClusterDecision(
      jsonRequest("http://test", { action: "reject", rationale: "Not relevant" }),
      { params: Promise.resolve({ roundId: "round-1", clusterId: "abc" }) }
    );

    expect(response.status).toBe(422);
    await expect(readJson(response)).resolves.toMatchObject({
      detail: "Cluster id must be an integer",
    });
  });

  it("surfaces cluster not found errors as 404", async () => {
    analyticsActionMocks.recordAnalyticsClusterDecision.mockRejectedValue(
      new Error("Cluster not found")
    );

    const response = await POSTClusterDecision(
      jsonRequest("http://test", { action: "reject", rationale: "Not relevant" }),
      { params: Promise.resolve({ roundId: "round-1", clusterId: "7" }) }
    );

    expect(response.status).toBe(404);
  });
});
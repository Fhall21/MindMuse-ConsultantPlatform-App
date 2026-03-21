import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  insertCalls: [] as Array<{ table: unknown; payload: unknown }>,
}));

const authContextMock = vi.hoisted(() => ({
  requireCurrentUserId: vi.fn(),
}));

const ownershipMock = vi.hoisted(() => ({
  requireOwnedConsultation: vi.fn(),
  requireOwnedRound: vi.fn(),
}));

function makeSelectBuilder(result: unknown[]) {
  const builder: Record<string, unknown> = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    then: (resolve: (value: unknown[]) => void, reject: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  };

  return builder;
}

const fakeDb = vi.hoisted(() => {
  const tx = {
    insert(table: { [key: string]: unknown }) {
      return {
        values(payload: unknown) {
          testState.insertCalls.push({ table, payload });

          return {
            returning: async () => {
              if (table === analyticsJobs) {
                return [{ id: "job-1" }];
              }

              if (table === roundDecisions) {
                return [{ id: "decision-1" }];
              }

              return [];
            },
          };
        },
      };
    },
    update() {
      return {
        set: () => ({
          where: async () => undefined,
        }),
      };
    },
  };

  return {
    select: vi.fn(() => makeSelectBuilder(testState.selectQueue.shift() ?? [])),
    transaction: vi.fn(async (callback: (tx: typeof tx) => Promise<unknown>) => callback(tx)),
  };
});

vi.mock("@/db/client", () => ({
  db: fakeDb,
}));
vi.mock("@/lib/data/auth-context", () => authContextMock);
vi.mock("@/lib/data/ownership", () => ownershipMock);

import { analyticsJobs, auditLog, roundDecisions } from "@/db/schema";
import {
  recordAnalyticsClusterDecision,
  triggerConsultationAnalyticsJob,
} from "@/lib/actions/analytics";

describe("lib/actions/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.selectQueue = [];
    testState.insertCalls = [];
    authContextMock.requireCurrentUserId.mockResolvedValue("user-1");
    ownershipMock.requireOwnedConsultation.mockResolvedValue({ roundId: "round-1" });
    ownershipMock.requireOwnedRound.mockResolvedValue({ id: "round-1" });
  });

  it("queues a consultation analytics job and writes an audit row", async () => {
    testState.selectQueue = [[]];

    const result = await triggerConsultationAnalyticsJob("consultation-1", "round-1");

    expect(result).toEqual({ jobId: "job-1", status: "queued" });
    expect(fakeDb.transaction).toHaveBeenCalledTimes(1);
    expect(testState.insertCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: analyticsJobs }),
        expect.objectContaining({ table: auditLog }),
      ])
    );
  });

  it("records a cluster decision and writes an audit row", async () => {
    testState.selectQueue = [
      [
        {
          id: "cluster-row-1",
          roundId: "round-1",
          clusterId: 7,
          label: "Workload",
          representativeTerms: [],
          allTerms: [],
          consultationCount: 2,
          clusteredAt: new Date("2026-03-19T12:00:00.000Z"),
          createdAt: new Date("2026-03-19T12:00:00.000Z"),
        },
      ],
    ];

    const result = await recordAnalyticsClusterDecision({
      roundId: "round-1",
      clusterId: 7,
      action: "reject",
      rationale: "Not relevant",
    });

    expect(result).toEqual({
      data: {
        decisionId: "decision-1",
        roundId: "round-1",
        clusterId: 7,
        clusterRecordId: "cluster-row-1",
        action: "reject",
        decisionType: "management_rejected",
        label: "Workload",
        editedLabel: null,
      },
    });

    expect(fakeDb.transaction).toHaveBeenCalledTimes(1);
    expect(testState.insertCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: roundDecisions }),
        expect.objectContaining({ table: auditLog }),
      ])
    );
  });
});
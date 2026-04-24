import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  insertReturnQueue: [] as unknown[][],
  updateReturnQueue: [] as unknown[][],
  insertCalls: [] as Array<{ table: unknown; values: unknown }>,
  updateCalls: [] as Array<{ table: unknown; values: unknown }>,
  transactionCallCount: 0,
  transactionThrowOnCall: 0,
}));

function makeSelectBuilder(result: unknown[]) {
  const builder: Record<string, unknown> = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    innerJoin: () => builder,
    leftJoin: () => builder,
    limit: () => Promise.resolve(result),
    then: (resolve: (value: unknown[]) => void, reject: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  };

  return builder;
}

const fakeDb = vi.hoisted(() => {
  const dbMock: Record<string, unknown> = {
    select: vi.fn(() => makeSelectBuilder(testState.selectQueue.shift() ?? [])),
    insert(table: unknown) {
      return {
        values(values: unknown) {
          testState.insertCalls.push({ table, values });

          return {
            returning: async () => testState.insertReturnQueue.shift() ?? [],
          };
        },
      };
    },
    update(table: unknown) {
      return {
        set(values: unknown) {
          testState.updateCalls.push({ table, values });

          return {
            where: () => ({
              returning: async () => testState.updateReturnQueue.shift() ?? [],
            }),
          };
        },
      };
    },
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      testState.transactionCallCount += 1;

      if (
        testState.transactionThrowOnCall > 0 &&
        testState.transactionCallCount === testState.transactionThrowOnCall
      ) {
        throw new Error("simulated crm failure");
      }

      return callback(dbMock);
    }),
  };

  return dbMock;
});

vi.mock("@/db/client", () => ({
  db: fakeDb,
}));

import {
  completeDigitalInterviewSession,
  matchOrCreatePerson,
} from "@/lib/data/digital-interviews";

function makeFlowRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "flow-1",
    userId: "user-1",
    consultationId: null,
    title: "Digital interview",
    framework: "appreciative_inquiry",
    customFrameworkPrompt: null,
    topics: ["Workload", "Support"],
    depthLevel: "moderate",
    status: "active",
    completedCount: 0,
    shareToken: "share-1",
    createdAt: new Date("2026-04-23T10:00:00.000Z"),
    updatedAt: new Date("2026-04-23T10:00:00.000Z"),
    ...overrides,
  };
}

function makeSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "response-1",
    flowId: "flow-1",
    sessionToken: "session-1",
    intervieweeName: "Alex",
    intervieweeEmail: "alex@example.com",
    intervieweeRole: "Manager",
    intervieweeWorkGroup: "Operations",
    intervieweeOrganisation: "Example Org",
    personId: null,
    personMatchConfidence: null,
    conversationHistory: [],
    status: "in_progress",
    completedAt: null,
    createdAt: new Date("2026-04-23T10:00:00.000Z"),
    updatedAt: new Date("2026-04-23T10:00:00.000Z"),
    ...overrides,
  };
}

function makeOrganisationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "org-1",
    name: "Example Org",
    userId: "user-1",
    createdAt: new Date("2026-04-22T10:00:00.000Z"),
    updatedAt: new Date("2026-04-22T10:00:00.000Z"),
    ...overrides,
  };
}

function makePersonRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "person-1",
    name: "Alex",
    workingGroup: "Operations",
    workType: null,
    role: "Manager",
    email: "alex@example.com",
    organisationId: "org-1",
    userId: "user-1",
    createdAt: new Date("2026-04-22T10:00:00.000Z"),
    ...overrides,
  };
}

describe("digital interview CRM linking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.selectQueue = [];
    testState.insertReturnQueue = [];
    testState.updateReturnQueue = [];
    testState.insertCalls = [];
    testState.updateCalls = [];
    testState.transactionCallCount = 0;
    testState.transactionThrowOnCall = 0;
  });

  it("matches an existing person with high confidence when organisation matches", async () => {
    testState.selectQueue = [[makeOrganisationRow()], [makePersonRow()]];

    await expect(
      matchOrCreatePerson(fakeDb as never, {
        userId: "user-1",
        interviewee: {
          name: "Alex",
          email: "alex@example.com",
          role: "Manager",
          workGroup: "Operations",
          organisation: "Example Org",
        },
      })
    ).resolves.toEqual({ personId: "person-1", confidence: "high" });

    expect(testState.insertCalls).toHaveLength(0);
  });

  it("matches by name only with medium confidence", async () => {
    testState.selectQueue = [[], [makePersonRow({ organisationId: "org-2" })]];

    await expect(
      matchOrCreatePerson(fakeDb as never, {
        userId: "user-1",
        interviewee: {
          name: "Alex",
          email: "alex@example.com",
          role: "Manager",
          workGroup: "Operations",
          organisation: "Different Org",
        },
      })
    ).resolves.toEqual({ personId: "person-1", confidence: "medium" });

    expect(testState.insertCalls).toHaveLength(0);
  });

  it("creates organisation and person when no match exists", async () => {
    testState.selectQueue = [[], []];
    testState.insertReturnQueue = [[{ id: "org-2" }], [{ id: "person-2" }]];

    await expect(
      matchOrCreatePerson(fakeDb as never, {
        userId: "user-1",
        interviewee: {
          name: "Jordan",
          email: "jordan@example.com",
          role: "Lead",
          workGroup: "Field Ops",
          organisation: "New Org",
        },
      })
    ).resolves.toEqual({ personId: "person-2", confidence: "created" });

    expect(testState.insertCalls).toHaveLength(2);
    expect(testState.insertCalls[0]).toMatchObject({
      values: expect.objectContaining({
        name: "New Org",
        userId: "user-1",
      }),
    });
    expect(testState.insertCalls[1]).toMatchObject({
      values: expect.objectContaining({
        name: "Jordan",
        email: "jordan@example.com",
        role: "Lead",
        workingGroup: "Field Ops",
        organisationId: "org-2",
        userId: "user-1",
      }),
    });
  });

  it("skips organisation creation when organisation is blank", async () => {
    testState.selectQueue = [[]];
    testState.insertReturnQueue = [[{ id: "person-3" }]];

    await expect(
      matchOrCreatePerson(fakeDb as never, {
        userId: "user-1",
        interviewee: {
          name: "Taylor",
          email: null,
          role: "Analyst",
          workGroup: "Research",
          organisation: "",
        },
      })
    ).resolves.toEqual({ personId: "person-3", confidence: "created" });

    expect(testState.insertCalls).toHaveLength(1);
    expect(testState.insertCalls[0]).toMatchObject({
      values: expect.objectContaining({
        name: "Taylor",
        organisationId: null,
        userId: "user-1",
      }),
    });
  });

  it("links CRM person when the session completes", async () => {
    testState.selectQueue = [
      [makeFlowRow()],
      [makeSessionRow()],
      [makeOrganisationRow()],
      [makePersonRow()],
    ];
    testState.updateReturnQueue = [
      [makeSessionRow({
        status: "completed",
        completedAt: new Date("2026-04-23T10:05:00.000Z"),
        updatedAt: new Date("2026-04-23T10:05:00.000Z"),
      })],
      [makeSessionRow({
        status: "completed",
        completedAt: new Date("2026-04-23T10:05:00.000Z"),
        updatedAt: new Date("2026-04-23T10:06:00.000Z"),
        personId: "person-1",
        personMatchConfidence: "high",
      })],
    ];

    const session = await completeDigitalInterviewSession({
      shareToken: "share-1",
      sessionToken: "session-1",
    });

    expect(session).toMatchObject({
      status: "completed",
      person_id: "person-1",
      person_match_confidence: "high",
    });
  });

  it("completes the session even if CRM linking fails", async () => {
    testState.selectQueue = [[makeFlowRow()], [makeSessionRow()]];
    testState.updateReturnQueue = [[makeSessionRow({ status: "completed" })]];
    testState.transactionThrowOnCall = 2;

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const session = await completeDigitalInterviewSession({
      shareToken: "share-1",
      sessionToken: "session-1",
    });

    expect(session).toMatchObject({
      status: "completed",
      person_id: null,
      person_match_confidence: null,
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to link digital interview session to CRM",
      expect.any(Error)
    );

    errorSpy.mockRestore();
  });
});

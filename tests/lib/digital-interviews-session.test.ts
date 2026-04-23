import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  insertCalls: [] as Array<{ table: unknown; values: unknown }>,
  updateCalls: [] as Array<{ table: unknown; values: unknown }>,
}));

const cryptoMock = vi.hoisted(() => ({
  randomUUID: vi.fn(),
}));

function makeSelectBuilder(result: unknown[]) {
  const builder: Record<string, unknown> = {
    from: () => builder,
    where: () => builder,
    limit: () => Promise.resolve(result),
    then: (resolve: (value: unknown[]) => void, reject: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  };

  return builder;
}

const fakeDb = vi.hoisted(() => {
  return {
    select: vi.fn(() => makeSelectBuilder(testState.selectQueue.shift() ?? [])),
    insert(table: unknown) {
      return {
        values(values: unknown) {
          testState.insertCalls.push({ table, values });

          return {
            returning: async () => [
              {
                id: "response-1",
                flowId: "flow-1",
                sessionToken: "session-1",
                intervieweeName: null,
                intervieweeEmail: null,
                intervieweeRole: null,
                intervieweeWorkGroup: null,
                intervieweeOrganisation: null,
                personId: null,
                personMatchConfidence: null,
                conversationHistory: [],
                status: "in_progress",
                completedAt: null,
                createdAt: new Date("2026-04-23T10:00:00.000Z"),
                updatedAt: new Date("2026-04-23T10:00:00.000Z"),
              },
            ],
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
              returning: async () => [
                {
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
                  updatedAt: new Date("2026-04-23T10:05:00.000Z"),
                },
              ],
            }),
          };
        },
      };
    },
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({})),
  };
});

vi.mock("node:crypto", () => cryptoMock);
vi.mock("@/db/client", () => ({
  db: fakeDb,
}));

import { responseToTranscript } from "@/lib/digital-interviews";
import {
  createOrResumeDigitalInterviewSession,
  updateDigitalInterviewSessionDetails,
} from "@/lib/data/digital-interviews";

describe("lib/digital-interviews", () => {
  it("keeps only user turns", () => {
    expect(
      responseToTranscript({
        conversationHistory: [
          { role: "assistant", content: "Hello", timestamp: "2026-04-23T10:00:00.000Z" },
          { role: "user", content: "First answer", timestamp: "2026-04-23T10:01:00.000Z" },
          { role: "assistant", content: "Follow-up", timestamp: "2026-04-23T10:02:00.000Z" },
          { role: "user", content: "Second answer", timestamp: "2026-04-23T10:03:00.000Z" },
        ],
      } as never)
    ).toBe("First answer\n\nSecond answer");
  });
});

describe("lib/data/digital-interviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.selectQueue = [];
    testState.insertCalls = [];
    testState.updateCalls = [];
    cryptoMock.randomUUID.mockReturnValue("session-uuid");
  });

  it("returns null when the public flow is closed", async () => {
    testState.selectQueue = [
      [
        {
          id: "flow-1",
          status: "closed",
        },
      ],
    ];

    await expect(
      createOrResumeDigitalInterviewSession("share-1", { sessionToken: null })
    ).resolves.toBeNull();
    expect(testState.insertCalls).toHaveLength(0);
  });

  it("creates a fresh session when no stored token exists", async () => {
    testState.selectQueue = [
      [
        {
          id: "flow-1",
          status: "active",
        },
      ],
      [],
    ];

    await expect(
      createOrResumeDigitalInterviewSession("share-1", { sessionToken: null })
    ).resolves.toMatchObject({
      session_token: "session-1",
      status: "in_progress",
    });

    expect(cryptoMock.randomUUID).toHaveBeenCalledTimes(1);
    expect(testState.insertCalls).toHaveLength(1);
  });

  it("updates onboarding details for an in-progress session", async () => {
    testState.selectQueue = [
      [
        {
          id: "flow-1",
          status: "active",
        },
      ],
      [
        {
          id: "response-1",
          status: "in_progress",
        },
      ],
    ];

    await expect(
      updateDigitalInterviewSessionDetails({
        shareToken: "share-1",
        sessionToken: "session-1",
        details: {
          name: "Alex",
          role: "Manager",
          workGroup: "Operations",
          organisation: "Example Org",
          email: "alex@example.com",
        },
      })
    ).resolves.toMatchObject({
      interviewee_name: "Alex",
      interviewee_role: "Manager",
      interviewee_work_group: "Operations",
      interviewee_organisation: "Example Org",
    });

    expect(testState.updateCalls).toHaveLength(1);
    expect(testState.updateCalls[0]).toMatchObject({
      values: expect.objectContaining({
        intervieweeName: "Alex",
        intervieweeRole: "Manager",
        intervieweeWorkGroup: "Operations",
        intervieweeOrganisation: "Example Org",
        intervieweeEmail: "alex@example.com",
      }),
    });
  });
});

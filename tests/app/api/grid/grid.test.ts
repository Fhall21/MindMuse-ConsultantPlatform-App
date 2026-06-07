import { beforeEach, describe, expect, it, vi } from "vitest";

const ROUND_ID = "11111111-1111-4111-a111-111111111111";
const MEETING_ID = "22222222-2222-4222-a222-222222222222";
const COLUMN_ID = "33333333-3333-4333-a333-333333333333";
const CELL_ID = "44444444-4444-4444-a444-444444444444";
const INSIGHT_ID = "55555555-5555-4555-a555-555555555555";
const JUNCTION_ID = "66666666-6666-4666-a666-666666666666";
const QUOTE_ID = "77777777-7777-4777-a777-777777777777";
const USER_ID = "99999999-9999-4999-a999-999999999999";

type Operation = {
  kind: "select" | "insert" | "update" | "delete";
  table?: unknown;
  payload?: unknown;
};

const authContextMock = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
}));

const ownershipMock = vi.hoisted(() => ({
  requireOwnedRound: vi.fn(),
}));

const routeHelpersMock = vi.hoisted(() => ({
  forwardJsonToAi: vi.fn(),
}));

const auditMock = vi.hoisted(() => ({
  insertAuditLogEntry: vi.fn(),
}));

const dbMock = vi.hoisted(() => {
  type QueryKind = "select" | "insert" | "update" | "delete";
  type QueryOperation = {
    kind: QueryKind;
    table?: unknown;
    payload?: unknown;
  };

  const state = {
    results: [] as unknown[],
    operations: [] as QueryOperation[],
  };

  class MockQuery implements PromiseLike<unknown> {
    private readonly result: unknown;

    constructor(private readonly operation: QueryOperation) {
      this.result = state.results.shift() ?? [];
      state.operations.push(operation);
    }

    from(table: unknown) {
      this.operation.table = table;
      return this;
    }

    innerJoin() {
      return this;
    }

    where() {
      return this;
    }

    orderBy() {
      return this;
    }

    limit() {
      return this;
    }

    for() {
      return this;
    }

    values(payload: unknown) {
      this.operation.payload = payload;
      return this;
    }

    set(payload: unknown) {
      this.operation.payload = payload;
      return this;
    }

    returning() {
      return this;
    }

    onConflictDoUpdate() {
      return this;
    }

    onConflictDoNothing() {
      return this;
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?:
        | ((value: unknown) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?:
        | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
        | null
    ): PromiseLike<TResult1 | TResult2> {
      return Promise.resolve(this.result).then(onfulfilled, onrejected);
    }
  }

  const db = {
    select: vi.fn(() => new MockQuery({ kind: "select" })),
    insert: vi.fn((table: unknown) => new MockQuery({ kind: "insert", table })),
    update: vi.fn((table: unknown) => new MockQuery({ kind: "update", table })),
    delete: vi.fn((table: unknown) => new MockQuery({ kind: "delete", table })),
    transaction: vi.fn(),
  };

  return { db, state };
});

vi.mock("@/lib/data/auth-context", () => authContextMock);
vi.mock("@/lib/data/ownership", () => ownershipMock);
vi.mock("@/lib/api/route-helpers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/route-helpers")>()),
  forwardJsonToAi: routeHelpersMock.forwardJsonToAi,
}));
vi.mock("@/lib/data/audit-log", () => auditMock);
vi.mock("@/db/client", () => ({ db: dbMock.db }));
vi.mock("@/lib/env", () => ({
  getAiServiceUrl: vi.fn(() => "http://ai.example.com"),
  getBetterAuthSecret: vi.fn(() => "test-secret-at-least-thirty-two-characters"),
  requireEnv: vi.fn(() => "test-secret-at-least-thirty-two-characters"),
}));

import {
  auditLog,
  gridCellInsights,
  gridCells,
  gridColumns,
  insights,
  quoteInsightLinks,
} from "@/db/schema";
import { GET as getGrid } from "@/app/api/client/consultations/[roundId]/grid/route";
import { POST as createColumn } from "@/app/api/client/consultations/[roundId]/grid/columns/route";
import {
  DELETE as deleteColumn,
  PATCH as updateColumn,
} from "@/app/api/client/consultations/[roundId]/grid/columns/[columnId]/route";
import { POST as initializeGeneration } from "@/app/api/client/consultations/[roundId]/grid/generate/route";
import { GET as getCells } from "@/app/api/client/consultations/[roundId]/grid/cells/route";
import { GET as getCellInsights } from "@/app/api/client/consultations/[roundId]/grid/cells/[cellId]/insights/route";
import { GET as getRoundInsights } from "@/app/api/client/consultations/[roundId]/grid/insights/route";
import { POST as generateMeeting } from "@/app/api/client/consultations/[roundId]/grid/meetings/[meetingId]/generate/route";
import { GET as suggestColumns } from "@/app/api/client/consultations/[roundId]/grid/column-suggestions/route";
import { PATCH as patchGridReview } from "@/app/api/client/insights/[id]/grid-review/route";
import { PATCH as patchInsight } from "@/app/api/client/insights/[id]/route";

function queueResults(...results: unknown[]) {
  dbMock.state.results.push(...results);
}

function request(method = "GET", body?: unknown, url = "http://test") {
  return new Request(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function roundParams() {
  return { params: Promise.resolve({ roundId: ROUND_ID }) };
}

function columnParams() {
  return { params: Promise.resolve({ roundId: ROUND_ID, columnId: COLUMN_ID }) };
}

function cellParams() {
  return { params: Promise.resolve({ roundId: ROUND_ID, cellId: CELL_ID }) };
}

function meetingParams() {
  return { params: Promise.resolve({ roundId: ROUND_ID, meetingId: MEETING_ID }) };
}

function insightParams() {
  return { params: Promise.resolve({ id: INSIGHT_ID }) };
}

async function body(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

function operations(kind: Operation["kind"], table: unknown) {
  return dbMock.state.operations.filter(
    (operation) => operation.kind === kind && operation.table === table
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.state.results.length = 0;
  dbMock.state.operations.length = 0;
  dbMock.db.transaction.mockImplementation(
    async (callback: (tx: typeof dbMock.db) => Promise<unknown>) =>
      callback(dbMock.db)
  );
  authContextMock.getCurrentUserId.mockResolvedValue(USER_ID);
  ownershipMock.requireOwnedRound.mockResolvedValue({
    id: ROUND_ID,
    userId: USER_ID,
  });
  auditMock.insertAuditLogEntry.mockResolvedValue(undefined);
  vi.stubGlobal("fetch", vi.fn());
});

describe("Analysis Grid API routes", () => {
  it("rejects unauthenticated requests across every grid handler", async () => {
    authContextMock.getCurrentUserId.mockResolvedValue(null);

    const responses = await Promise.all([
      getGrid(request(), roundParams()),
      createColumn(request("POST", { question: "Question?" }), roundParams()),
      updateColumn(request("PATCH", { position: 1 }), columnParams()),
      deleteColumn(request("DELETE"), columnParams()),
      initializeGeneration(request("POST", { columnId: COLUMN_ID }), roundParams()),
      getCells(request(), roundParams()),
      getCellInsights(request(), cellParams()),
      getRoundInsights(request(), roundParams()),
      generateMeeting(request("POST"), meetingParams()),
      suggestColumns(request(), roundParams()),
      patchGridReview(
        request("PATCH", {
          cellId: CELL_ID,
          gridReviewState: "accepted",
        }),
        insightParams()
      ),
    ]);

    expect(responses.every((response) => response.status === 401)).toBe(true);
  });

  it("returns 404 when authenticated user does not own a round", async () => {
    ownershipMock.requireOwnedRound.mockRejectedValue(new Error("Round not found"));

    const responses = [
      await getGrid(request(), roundParams()),
      await createColumn(
        request("POST", { question: "Question?" }),
        roundParams()
      ),
      await updateColumn(request("PATCH", { position: 1 }), columnParams()),
      await deleteColumn(request("DELETE"), columnParams()),
      await initializeGeneration(
        request("POST", { columnId: COLUMN_ID }),
        roundParams()
      ),
      await getCells(request(), roundParams()),
      await getCellInsights(request(), cellParams()),
      await getRoundInsights(request(), roundParams()),
      await suggestColumns(request(), roundParams()),
    ];

    queueResults([]);
    responses.push(await generateMeeting(request("POST"), meetingParams()));
    queueResults([]);
    responses.push(
      await patchGridReview(
        request("PATCH", {
          cellId: CELL_ID,
          gridReviewState: "accepted",
        }),
        insightParams()
      )
    );

    expect(responses.every((response) => response.status === 404)).toBe(true);
  });

  it("creates, updates, and deletes columns with ownership checks", async () => {
    const created = {
      id: COLUMN_ID,
      consultationId: ROUND_ID,
      userId: USER_ID,
      question: "What changed?",
      position: 0,
    };
    queueResults([], [created]);
    const createResponse = await createColumn(
      request("POST", { question: "What changed?" }),
      roundParams()
    );

    queueResults([created], [{ ...created, position: 2 }]);
    const updateResponse = await updateColumn(
      request("PATCH", { position: 2 }),
      columnParams()
    );

    queueResults([created], []);
    const deleteResponse = await deleteColumn(request("DELETE"), columnParams());

    expect(createResponse.status).toBe(201);
    expect(updateResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(operations("insert", gridColumns)).toHaveLength(1);
    expect(operations("update", gridColumns)).toHaveLength(1);
    expect(operations("delete", gridColumns)).toHaveLength(1);
  });

  it("initializes cells transactionally with conflict-safe upserts", async () => {
    queueResults(
      [{ id: COLUMN_ID }],
      [{ id: MEETING_ID }, { id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" }],
      [],
      []
    );

    const response = await initializeGeneration(
      request("POST", { columnId: COLUMN_ID }),
      roundParams()
    );

    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({
      meetingIds: [MEETING_ID, "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"],
    });
    expect(dbMock.db.transaction).toHaveBeenCalledOnce();
    expect(operations("insert", gridCells)).toHaveLength(2);
  });

  it("returns grid and cell read shapes", async () => {
    queueResults([{ id: COLUMN_ID }], [{ id: CELL_ID }]);
    const gridResponse = await getGrid(request(), roundParams());

    queueResults([{ id: CELL_ID, insightCount: 2 }]);
    const cellsResponse = await getCells(request(), roundParams());

    expect(await body(gridResponse)).toEqual({
      columns: [{ id: COLUMN_ID }],
      cells: [{ id: CELL_ID, status: "pending" }],
    });
    expect(await body(cellsResponse)).toEqual({
      cells: [{ id: CELL_ID, insightCount: 2, status: "pending" }],
    });
  });

  it("returns 409 when meeting generation is already running", async () => {
    queueResults(
      [{ id: MEETING_ID }],
      [{ id: CELL_ID, columnId: COLUMN_ID, status: "generating" }]
    );

    const response = await generateMeeting(request("POST"), meetingParams());

    expect(response.status).toBe(409);
    expect(await body(response)).toMatchObject({
      detail: "Generation already in progress",
    });

    queueResults(
      [{ id: MEETING_ID }],
      [{ id: CELL_ID, columnId: COLUMN_ID, status: "complete" }]
    );
    const completedResponse = await generateMeeting(
      request("POST"),
      meetingParams()
    );
    expect(completedResponse.status).toBe(409);
    expect(await body(completedResponse)).toMatchObject({
      detail: "All cells are already complete",
    });
  });

  it("preserves reviewed junctions during retry", async () => {
    queueResults(
      [{ id: MEETING_ID, transcriptRaw: "Transcript" }],
      [{ id: CELL_ID, columnId: COLUMN_ID, status: "failed" }],
      [],
      [],
      [],
      [{ id: COLUMN_ID, question: "What changed?", position: 0 }],
      [{ insightId: INSIGHT_ID }],
      [{ quoteId: QUOTE_ID }],
      [],
      [{ cellId: CELL_ID, status: "complete", insightCount: 1 }]
    );
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          answers: [
            {
              columnId: COLUMN_ID,
              cellId: CELL_ID,
              insights: [],
              confidence: null,
              hasEvidence: false,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const response = await generateMeeting(
      request("POST", undefined, "http://test?retry=true"),
      meetingParams()
    );

    expect(response.status).toBe(200);
    expect(operations("delete", gridCellInsights)).toHaveLength(1);
    expect(await body(response)).toMatchObject({ meetingId: MEETING_ID });
  });

  it("blocks cross-meeting reuse and creates a new insight", async () => {
    const otherInsightId = "88888888-8888-4888-a888-888888888888";
    queueResults(
      [{ id: MEETING_ID, transcriptRaw: "Alex: We struggled." }],
      [{ id: CELL_ID, columnId: COLUMN_ID, status: "pending" }],
      [],
      [{ id: COLUMN_ID, question: "What changed?", position: 0 }],
      [],
      [{ id: INSIGHT_ID }],
      [],
      [{ id: QUOTE_ID }],
      [],
      [{ insightId: INSIGHT_ID }],
      [{ quoteId: QUOTE_ID }],
      [],
      [{ cellId: CELL_ID, status: "complete", insightCount: 1 }]
    );
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          answers: [
            {
              columnId: COLUMN_ID,
              cellId: CELL_ID,
              insights: [
                {
                  text: "Work was difficult",
                  existingInsightId: otherInsightId,
                  quotes: [
                    {
                      exactText: "Alex: We struggled.",
                      spanStart: 0,
                      spanEnd: 19,
                      relevanceStrength: "strong_match",
                    },
                  ],
                },
              ],
              confidence: "high",
              hasEvidence: true,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const response = await generateMeeting(request("POST"), meetingParams());

    expect(response.status).toBe(200);
    expect(operations("insert", insights)).toHaveLength(1);
    expect(operations("insert", quoteInsightLinks)).toHaveLength(1);
  });

  it("marks cells failed and returns 408 on timeout", async () => {
    queueResults(
      [{ id: MEETING_ID, transcriptRaw: "Transcript" }],
      [{ id: CELL_ID, columnId: COLUMN_ID, status: "pending" }],
      [],
      [{ id: COLUMN_ID, question: "Question?", position: 0 }],
      []
    );
    vi.mocked(fetch).mockRejectedValue(
      new DOMException("Request timed out", "AbortError")
    );

    const response = await generateMeeting(request("POST"), meetingParams());

    expect(response.status).toBe(408);
    expect(operations("update", gridCells).at(-1)?.payload).toMatchObject({
      status: "failed",
    });
  });

  it("rejects malformed AI responses and marks cells failed", async () => {
    queueResults(
      [{ id: MEETING_ID, transcriptRaw: "Transcript" }],
      [{ id: CELL_ID, columnId: COLUMN_ID, status: "pending" }],
      [],
      [{ id: COLUMN_ID, question: "Question?", position: 0 }],
      []
    );
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ answers: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const response = await generateMeeting(request("POST"), meetingParams());

    expect(response.status).toBe(500);
    expect(operations("update", gridCells).at(-1)?.payload).toMatchObject({
      status: "failed",
    });
  });

  it("rolls back grid review writes when transaction fails", async () => {
    queueResults(
      [{
        id: INSIGHT_ID,
        meetingId: MEETING_ID,
        label: "Original",
        consultationId: ROUND_ID,
      }],
      [{ id: CELL_ID, consultationId: ROUND_ID, columnId: COLUMN_ID }],
      [{ id: JUNCTION_ID, gridColumnId: COLUMN_ID }]
    );
    dbMock.db.transaction.mockRejectedValueOnce(new Error("Database write failed"));

    const response = await patchGridReview(
      request("PATCH", {
        cellId: CELL_ID,
        gridReviewState: "accepted",
      }),
      insightParams()
    );

    expect(response.status).toBe(500);
    expect(operations("update", gridCellInsights)).toHaveLength(0);
    expect(operations("update", insights)).toHaveLength(0);
  });

  it("syncs accept and rejection reversal flags in one transaction", async () => {
    queueResults(
      [{
        id: INSIGHT_ID,
        meetingId: MEETING_ID,
        label: "Original",
        consultationId: ROUND_ID,
      }],
      [{ id: CELL_ID, consultationId: ROUND_ID, columnId: COLUMN_ID }],
      [{ id: JUNCTION_ID, gridColumnId: COLUMN_ID }],
      [],
      [{ accepted: true, rejected: false }],
      [],
      [],
      [{ id: INSIGHT_ID, junctionId: JUNCTION_ID }],
      [],
      []
    );
    const acceptedResponse = await patchGridReview(
      request("PATCH", {
        cellId: CELL_ID,
        gridReviewState: "accepted",
      }),
      insightParams()
    );

    expect(acceptedResponse.status).toBe(200);
    expect(operations("update", insights).at(-1)?.payload).toMatchObject({
      accepted: true,
      rejected: false,
    });
    expect(operations("insert", auditLog)).toHaveLength(1);

    dbMock.state.operations.length = 0;
    queueResults(
      [{
        id: INSIGHT_ID,
        meetingId: MEETING_ID,
        label: "Original",
        consultationId: ROUND_ID,
      }],
      [{ id: CELL_ID, consultationId: ROUND_ID, columnId: COLUMN_ID }],
      [{ id: JUNCTION_ID, gridColumnId: COLUMN_ID }],
      [],
      [
        { accepted: false, rejected: false },
        { accepted: false, rejected: true },
      ],
      [],
      [],
      [{ id: INSIGHT_ID, junctionId: JUNCTION_ID }],
      [],
      []
    );
    const reversalResponse = await patchGridReview(
      request("PATCH", {
        cellId: CELL_ID,
        gridReviewState: "pending",
      }),
      insightParams()
    );

    expect(reversalResponse.status).toBe(200);
    expect(operations("update", insights).at(-1)?.payload).toMatchObject({
      rejected: false,
    });
  });

  it("supports cell-local and global label edits", async () => {
    queueResults(
      [{
        id: INSIGHT_ID,
        meetingId: MEETING_ID,
        label: "Original",
        consultationId: ROUND_ID,
      }],
      [{ id: CELL_ID, consultationId: ROUND_ID, columnId: COLUMN_ID }],
      [{ id: JUNCTION_ID, gridColumnId: COLUMN_ID }],
      [],
      [],
      [],
      [{ accepted: false, rejected: false }],
      [],
      [{ id: INSIGHT_ID, editedLabel: "Cell label" }],
      [],
      []
    );
    const cellResponse = await patchGridReview(
      request("PATCH", {
        cellId: CELL_ID,
        gridReviewState: "edited",
        editedText: "Cell label",
        editScope: "cell",
      }),
      insightParams()
    );
    expect(cellResponse.status).toBe(200);
    expect(operations("update", gridCellInsights)[0]?.payload).toMatchObject({
      editedLabel: "Cell label",
      gridReviewState: "edited",
    });

    dbMock.state.operations.length = 0;
    queueResults(
      [{
        id: INSIGHT_ID,
        meetingId: MEETING_ID,
        label: "Original",
        consultationId: ROUND_ID,
      }],
      [{ id: CELL_ID, consultationId: ROUND_ID, columnId: COLUMN_ID }],
      [{ id: JUNCTION_ID, gridColumnId: COLUMN_ID }],
      [],
      [],
      [],
      [{ accepted: false, rejected: false }],
      [],
      [{ id: INSIGHT_ID, label: "Global label" }],
      [],
      []
    );
    const globalResponse = await patchGridReview(
      request("PATCH", {
        cellId: CELL_ID,
        gridReviewState: "edited",
        editedText: "Global label",
        editScope: "all",
      }),
      insightParams()
    );
    expect(globalResponse.status).toBe(200);
    expect(operations("update", insights)[0]?.payload).toMatchObject({
      label: "Global label",
    });
    expect(operations("insert", auditLog)).toHaveLength(1);
  });

  it("loads connected columns and quotes in batch queries", async () => {
    const secondInsightId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
    queueResults(
      [{ id: CELL_ID }],
      [
        { id: INSIGHT_ID, gridCellId: CELL_ID },
        { id: secondInsightId, gridCellId: CELL_ID },
      ],
      [
        {
          insightId: INSIGHT_ID,
          columnId: COLUMN_ID,
          question: "Question?",
          gridReviewState: "pending",
          accepted: false,
        },
        {
          insightId: secondInsightId,
          columnId: COLUMN_ID,
          question: "Question?",
          gridReviewState: "accepted",
          accepted: true,
        },
      ],
      []
    );

    const response = await getCellInsights(request(), cellParams());
    const responseBody = await body(response);

    expect(response.status).toBe(200);
    expect(responseBody.insights).toHaveLength(2);
    expect(dbMock.state.operations.filter((operation) => operation.kind === "select"))
      .toHaveLength(4);
  });

  it("returns all round insights and validates column suggestions", async () => {
    queueResults([]);
    const insightsResponse = await getRoundInsights(request(), roundParams());
    expect(await body(insightsResponse)).toEqual({ insights: [] });

    queueResults([{ transcriptRaw: "Transcript" }]);
    routeHelpersMock.forwardJsonToAi.mockResolvedValue(
      Response.json({ suggestions: ["What changed?"] })
    );
    const suggestionResponse = await suggestColumns(request(), roundParams());
    expect(await body(suggestionResponse)).toEqual({
      suggestions: ["What changed?"],
    });

    queueResults([{ transcriptRaw: "Transcript" }]);
    routeHelpersMock.forwardJsonToAi.mockResolvedValue(
      Response.json({ suggestions: ["1", "2", "3", "4", "5", "6"] })
    );
    const invalidResponse = await suggestColumns(request(), roundParams());
    expect(invalidResponse.status).toBe(502);
  });

  it("keeps existing non-grid insight PATCH behavior working", async () => {
    queueResults(
      [{ id: INSIGHT_ID, meetingId: MEETING_ID, label: "Original" }],
      []
    );

    const response = await patchInsight(
      request("PATCH", { label: "Updated", description: "Description" }),
      insightParams()
    );

    expect(response.status).toBe(204);
    expect(operations("update", insights)[0]?.payload).toEqual({
      label: "Updated",
      description: "Description",
    });
    expect(auditMock.insertAuditLogEntry).toHaveBeenCalledOnce();
  });
});

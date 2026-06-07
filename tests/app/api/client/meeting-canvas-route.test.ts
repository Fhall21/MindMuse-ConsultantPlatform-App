import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

type Operation = {
  table?: unknown;
  where?: unknown;
};

const dbMock = vi.hoisted(() => {
  const state = {
    results: [] as unknown[],
    operations: [] as Operation[],
  };

  class Query implements PromiseLike<unknown> {
    private readonly result: unknown;

    constructor(private readonly operation: Operation) {
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

    where(condition: unknown) {
      this.operation.where = condition;
      return this;
    }

    orderBy() {
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

  return {
    db: {
      select: vi.fn(() => new Query({})),
    },
    state,
  };
});

const routeClientMock = vi.hoisted(() => ({
  requireRouteClient: vi.fn(),
  jsonError: vi.fn((message: string, status = 500) =>
    Response.json({ detail: message }, { status })
  ),
}));

const ownershipMock = vi.hoisted(() => ({
  requireOwnedMeeting: vi.fn(),
  requireOwnedRound: vi.fn(),
}));

const canvasDataMock = vi.hoisted(() => ({
  loadCanvasConnections: vi.fn(),
  loadCanvasLayout: vi.fn(),
}));

vi.mock("@/db/client", () => ({ db: dbMock.db }));
vi.mock("@/app/api/client/_helpers", () => routeClientMock);
vi.mock("@/lib/data/ownership", () => ownershipMock);
vi.mock("@/lib/data/canvas", () => canvasDataMock);

import { insights } from "@/db/schema";
import { GET } from "@/app/api/client/meetings/[id]/canvas/route";
import { composeCanvasState } from "@/lib/data/canvas-state";

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.state.results.length = 0;
  dbMock.state.operations.length = 0;
  routeClientMock.requireRouteClient.mockResolvedValue({ userId: "user-1" });
  ownershipMock.requireOwnedMeeting.mockResolvedValue({ id: "meeting-1" });
  ownershipMock.requireOwnedRound.mockResolvedValue({ id: "round-1" });
  canvasDataMock.loadCanvasConnections.mockResolvedValue([]);
  canvasDataMock.loadCanvasLayout.mockResolvedValue({
    positions: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  });
});

describe("meeting canvas route", () => {
  it("filters insight nodes to accepted insights in SQL", async () => {
    dbMock.state.results.push(
      [{ id: "meeting-1", consultationId: "round-1" }],
      [],
      [],
      []
    );

    const response = await GET(new Request("http://test"), {
      params: Promise.resolve({ id: "meeting-1" }),
    });

    expect(response.status).toBe(200);
    const insightQuery = dbMock.state.operations.find(
      (operation) => operation.table === insights
    );
    expect(insightQuery?.where).toBeTruthy();

    const sql = new PgDialect().sqlToQuery(
      (insightQuery?.where as { getSQL(): unknown }).getSQL() as never
    ).sql;
    expect(sql).toContain('"insights"."accepted" = $3');
  });

  it("filters the active consultation canvas to accepted insights in SQL", async () => {
    dbMock.state.results.push([], [], [], []);

    await composeCanvasState("round-1", "user-1");

    const insightQuery = dbMock.state.operations.find(
      (operation) => operation.table === insights
    );
    expect(insightQuery?.where).toBeTruthy();

    const sql = new PgDialect().sqlToQuery(
      (insightQuery?.where as { getSQL(): unknown }).getSQL() as never
    ).sql;
    expect(sql).toContain('"insights"."accepted" = $3');
  });
});

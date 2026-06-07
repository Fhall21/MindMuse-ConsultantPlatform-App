import { beforeEach, describe, expect, it, vi } from "vitest";

type Operation = {
  kind: "select" | "update";
  table?: unknown;
  payload?: unknown;
};

const dbMock = vi.hoisted(() => ({
  db: {
    transaction: vi.fn(),
  },
}));

vi.mock("@/db/client", () => dbMock);

import { quoteInsightLinks, quotes } from "@/db/schema";
import { repairGridQuoteLifecycle } from "@/lib/data/grid-quote-repair";

function createTransaction(...results: unknown[]) {
  const operations: Operation[] = [];
  const queue = [...results];

  class Query implements PromiseLike<unknown> {
    private readonly result: unknown;

    constructor(private readonly operation: Operation) {
      this.result = queue.shift() ?? [];
      operations.push(operation);
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

    limit() {
      return this;
    }

    set(payload: unknown) {
      this.operation.payload = payload;
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

  const tx = {
    select: vi.fn(() => new Query({ kind: "select" })),
    update: vi.fn((table: unknown) => new Query({ kind: "update", table })),
  };

  return { tx, operations };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("repairGridQuoteLifecycle", () => {
  it("repairs provenance, statuses, and link types", async () => {
    const { tx, operations } = createTransaction(
      [
        { quoteId: "quote-manual", status: "approved", approvalOrigin: null },
        { quoteId: "quote-insight", status: "approved", approvalOrigin: null },
        { quoteId: "quote-stale", status: "approved", approvalOrigin: null },
      ],
      [{ quoteId: "quote-manual" }],
      [],
      [{ insightId: "insight-accepted" }],
      [],
      [],
      [],
      [
        {
          quoteId: "quote-manual",
          insightId: "insight-manual",
          linkType: "durable",
          insightAccepted: true,
        },
        {
          quoteId: "quote-insight",
          insightId: "insight-accepted",
          linkType: "provisional",
          insightAccepted: true,
        },
        {
          quoteId: "quote-stale",
          insightId: "insight-pending",
          linkType: "durable",
          insightAccepted: false,
        },
      ],
      [],
      []
    );
    dbMock.db.transaction.mockImplementation(async (callback) => callback(tx));

    await expect(repairGridQuoteLifecycle()).resolves.toEqual({
      manualOrigins: 1,
      insightOrigins: 1,
      demotedQuotes: 1,
      durableLinks: 1,
      provisionalLinks: 1,
    });

    const quoteUpdates = operations.filter(
      (operation) => operation.kind === "update" && operation.table === quotes
    );
    expect(quoteUpdates.map((operation) => operation.payload)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ approvalOrigin: "manual" }),
        expect.objectContaining({ approvalOrigin: "insight" }),
        expect.objectContaining({
          status: "suggested",
          approvalOrigin: null,
        }),
      ])
    );
    expect(
      operations.filter(
        (operation) =>
          operation.kind === "update" && operation.table === quoteInsightLinks
      )
    ).toHaveLength(2);
  });

  it("makes no changes when data is already normalized", async () => {
    const { tx, operations } = createTransaction(
      [{ quoteId: "quote-1", status: "approved", approvalOrigin: "manual" }],
      [{ quoteId: "quote-1" }],
      [
        {
          quoteId: "quote-1",
          insightId: "insight-1",
          linkType: "durable",
          insightAccepted: true,
        },
      ]
    );
    dbMock.db.transaction.mockImplementation(async (callback) => callback(tx));

    await expect(repairGridQuoteLifecycle()).resolves.toEqual({
      manualOrigins: 0,
      insightOrigins: 0,
      demotedQuotes: 0,
      durableLinks: 0,
      provisionalLinks: 0,
    });
    expect(
      operations.filter((operation) => operation.kind === "update")
    ).toHaveLength(0);
  });
});

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

import {
  gridCellInsights,
  insights,
  quoteInsightLinks,
  quotes,
} from "@/db/schema";
import { syncInsightReviewLifecycle } from "@/lib/data/insight-review-lifecycle";

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

function updates(operations: Operation[], table: unknown) {
  return operations.filter(
    (operation) => operation.kind === "update" && operation.table === table
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("syncInsightReviewLifecycle", () => {
  it("promotes suggested quotes when insight becomes accepted", async () => {
    const { tx, operations } = createTransaction(
      [],
      [{ accepted: true, rejected: false }],
      [],
      [{ quoteId: "quote-1", status: "suggested", approvalOrigin: null }],
      [],
      []
    );

    await syncInsightReviewLifecycle(tx as never, {
      insightId: "insight-1",
      userId: "user-1",
      state: "accepted",
      scope: { kind: "all" },
    });

    expect(updates(operations, insights).at(-1)?.payload).toMatchObject({
      accepted: true,
      rejected: false,
    });
    expect(updates(operations, quoteInsightLinks).at(-1)?.payload).toEqual({
      linkType: "durable",
    });
    expect(updates(operations, quotes).at(-1)?.payload).toMatchObject({
      status: "approved",
      approvalOrigin: "insight",
      approvedBy: "user-1",
    });
  });

  it("demotes insight-approved quote when no accepted link remains", async () => {
    const { tx, operations } = createTransaction(
      [],
      [{ accepted: false, rejected: true }],
      [],
      [{ quoteId: "quote-1", status: "approved", approvalOrigin: "insight" }],
      [],
      [],
      []
    );

    await syncInsightReviewLifecycle(tx as never, {
      insightId: "insight-1",
      userId: "user-1",
      state: "rejected",
      scope: { kind: "junction", junctionId: "junction-1" },
    });

    expect(updates(operations, quoteInsightLinks).at(-1)?.payload).toEqual({
      linkType: "provisional",
    });
    expect(updates(operations, quotes).at(-1)?.payload).toMatchObject({
      status: "suggested",
      approvalOrigin: null,
      approvedAt: null,
      approvedBy: null,
    });
  });

  it("never demotes manually approved quotes", async () => {
    const { tx, operations } = createTransaction(
      [],
      [{ accepted: false, rejected: true }],
      [],
      [{ quoteId: "quote-1", status: "approved", approvalOrigin: "manual" }],
      []
    );

    await syncInsightReviewLifecycle(tx as never, {
      insightId: "insight-1",
      userId: "user-1",
      state: "rejected",
      scope: { kind: "all" },
    });

    expect(updates(operations, quotes)).toHaveLength(0);
    expect(updates(operations, gridCellInsights)).toHaveLength(1);
  });

  it("keeps quote approved while another linked insight remains accepted", async () => {
    const { tx, operations } = createTransaction(
      [],
      [{ accepted: false, rejected: true }],
      [],
      [{ quoteId: "quote-1", status: "approved", approvalOrigin: "insight" }],
      [],
      [{ insightId: "insight-2" }]
    );

    await syncInsightReviewLifecycle(tx as never, {
      insightId: "insight-1",
      userId: "user-1",
      state: "rejected",
      scope: { kind: "all" },
    });

    expect(updates(operations, quotes)).toHaveLength(0);
  });
});

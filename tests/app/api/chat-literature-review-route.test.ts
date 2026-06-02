import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chatMessages, chatSessions, chatToolResults, researchSessions } from "@/db/schema";

const routeHelpersMock = vi.hoisted(() => ({
  requireAuthenticatedApiUser: vi.fn(async () => ({ id: "11111111-1111-4111-8111-111111111111" })),
}));

function makeChain(resolveValue: unknown) {
  const thenable = Promise.resolve(resolveValue);
  const chain: Record<string, unknown> = {};
  for (const method of ["from", "innerJoin", "where", "limit", "values", "returning", "set"]) {
    chain[method] = vi.fn(() => chain);
  }
  Object.assign(chain, {
    then: thenable.then.bind(thenable),
    catch: thenable.catch.bind(thenable),
    finally: thenable.finally.bind(thenable),
  });
  return chain;
}

const txMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}));

const dbMock = vi.hoisted(() => ({
  transaction: vi.fn(async (callback: (tx: typeof txMock) => unknown) => callback(txMock)),
}));

vi.mock("@/lib/api/route-helpers", () => routeHelpersMock);
vi.mock("@/db/client", () => ({ db: dbMock }));

import { POST } from "@/app/api/chat/literature-review/route";

function request(body: unknown) {
  return new NextRequest("http://test.local/api/chat/literature-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat/literature-review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.select.mockReturnValue(makeChain([{ id: "22222222-2222-4222-8222-222222222222" }]));
    txMock.insert.mockImplementation((table) =>
      table === researchSessions
        ? makeChain([{ id: "33333333-3333-4333-8333-333333333333" }])
        : makeChain([])
    );
    txMock.update.mockReturnValue(makeChain([]));
  });

  it("creates a pending worker row and marks the owned chat card successful", async () => {
    const response = await POST(
      request({
        sessionId: "44444444-4444-4444-8444-444444444444",
        toolResultId: "22222222-2222-4222-8222-222222222222",
        query: "Which factors increase susceptibility to harmful management?",
        industry_ctx: "healthcare",
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "33333333-3333-4333-8333-333333333333",
    });
    expect(txMock.insert).toHaveBeenCalledWith(researchSessions);
    expect(txMock.insert).toHaveBeenCalledWith(chatMessages);
    expect(txMock.update).toHaveBeenCalledWith(chatToolResults);
    expect(txMock.update).toHaveBeenCalledWith(chatSessions);

    const researchInsert = txMock.insert.mock.results.find(
      (result, index) => txMock.insert.mock.calls[index]?.[0] === researchSessions
    )?.value as { values: ReturnType<typeof vi.fn> };
    expect(researchInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionType: "literature",
        status: "pending",
        industryCtx: "healthcare",
      })
    );
  });

  it("does not enqueue research when the session or proposal is not owned", async () => {
    txMock.select.mockReturnValue(makeChain([]));

    const response = await POST(
      request({
        sessionId: "44444444-4444-4444-8444-444444444444",
        toolResultId: "22222222-2222-4222-8222-222222222222",
        query: "Which factors increase susceptibility to harmful management?",
      })
    );

    expect(response.status).toBe(404);
    expect(txMock.insert).not.toHaveBeenCalled();
  });
});

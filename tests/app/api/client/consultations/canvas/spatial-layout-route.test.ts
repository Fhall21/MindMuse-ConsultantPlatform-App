import { beforeEach, describe, expect, it, vi } from "vitest";

// ── mocks ─────────────────────────────────────────────────────────────────────

const authContextMock = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
}));

const ownershipMock = vi.hoisted(() => ({
  requireOwnedRound: vi.fn(),
}));

const dbMock = vi.hoisted(() => {
  const chain = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
  };
  // Each method returns `chain` so call chains work
  Object.values(chain).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReturnValue(chain));
  return { db: chain };
});

vi.mock("@/lib/data/auth-context", () => authContextMock);
vi.mock("@/lib/data/ownership", () => ownershipMock);
vi.mock("@/db/client", () => dbMock);
vi.mock("@/db/schema/domain", () => ({
  canvasSpatialLayoutJobs: "canvasSpatialLayoutJobs",
}));
vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => col),
  eq: vi.fn((_col: unknown, val: unknown) => val),
  inArray: vi.fn((_col: unknown, vals: unknown) => vals),
}));
vi.mock("@/lib/api/route-helpers", () => ({
  getAiServiceUrlOrResponse: vi.fn(),
}));

import { GET, DELETE, POST } from "@/app/api/client/consultations/[roundId]/canvas/spatial-layout/route";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeParams(roundId = "round-1") {
  return { params: Promise.resolve({ roundId }) };
}

function makeRequest(method = "GET", body?: unknown) {
  return new Request("http://test", {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function readJson(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

// ── setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks(); // clears call history AND mockOnce queues
  // Re-seed chain: each method returns the chain (allows call chaining)
  for (const fn of Object.values(dbMock.db)) {
    if (typeof fn === "function") (fn as ReturnType<typeof vi.fn>).mockReturnValue(dbMock.db);
  }
  dbMock.db.limit.mockResolvedValue([]);
  dbMock.db.returning.mockResolvedValue([{ id: "job-1" }]);
  authContextMock.getCurrentUserId.mockResolvedValue("user-1");
  ownershipMock.requireOwnedRound.mockResolvedValue(undefined);
});

// ── POST: 409 guard ──────────────────────────────────────────────────────────

describe("POST /spatial-layout", () => {
  it("returns 409 when a running job already exists (D2)", async () => {
    // First DB query (409 guard) returns an existing job
    dbMock.db.limit.mockResolvedValueOnce([{ id: "existing-job", status: "running" }]);

    const res = (await POST(
      makeRequest("POST", { nodes: Array.from({ length: 3 }, (_, i) => ({ id: `n${i}`, text: `t${i}` })) }),
      makeParams()
    )) as Response;

    expect(res.status).toBe(409);
    await expect(readJson(res)).resolves.toMatchObject({ detail: expect.stringContaining("already running") });
  });
});

// ── GET: stale detection ──────────────────────────────────────────────────────

describe("GET /spatial-layout", () => {
  it("returns status:failed when running job is older than 90s (D3 stale path)", async () => {
    const staleStartedAt = new Date(Date.now() - 100_000).toISOString(); // 100s ago
    dbMock.db.limit.mockResolvedValueOnce([
      { id: "job-1", status: "running", startedAt: staleStartedAt },
    ]);

    const res = (await GET(makeRequest(), makeParams())) as Response;

    expect(res.status).toBe(200);
    await expect(readJson(res)).resolves.toEqual({ status: "failed" });
  });

  it("returns status:failed even when DB update throws (D3 resilience)", async () => {
    const staleStartedAt = new Date(Date.now() - 100_000).toISOString();
    dbMock.db.limit.mockResolvedValueOnce([
      { id: "job-1", status: "running", startedAt: staleStartedAt },
    ]);
    // SELECT where() returns chain (normal); UPDATE where() throws
    dbMock.db.where.mockReturnValueOnce(dbMock.db);
    dbMock.db.where.mockRejectedValueOnce(new Error("DB connection lost"));

    const res = (await GET(makeRequest(), makeParams())) as Response;

    expect(res.status).toBe(200);
    await expect(readJson(res)).resolves.toEqual({ status: "failed" });
  });
});

// ── DELETE: 404 when no running job ──────────────────────────────────────────

describe("DELETE /spatial-layout", () => {
  it("returns 404 when no running job exists", async () => {
    dbMock.db.limit.mockResolvedValueOnce([]); // no running job

    const res = (await DELETE(makeRequest("DELETE"), makeParams())) as Response;

    expect(res.status).toBe(404);
    await expect(readJson(res)).resolves.toMatchObject({ detail: expect.stringContaining("No running") });
  });
});

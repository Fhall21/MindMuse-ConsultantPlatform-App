import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routeHelpersMock = vi.hoisted(() => ({
  getAiServiceUrlOrResponse: vi.fn(() => "http://ai.example.com"),
  requireAuthenticatedApiUser: vi.fn(async () => ({ id: "user-1" })),
}));

vi.mock("@/lib/api/route-helpers", () => routeHelpersMock);

// ── Chainable DB mock for sessions routes ─────────────────────────────────────

function makeChainableMock(resolveValue: unknown) {
  const terminal = { then: undefined as unknown };
  // Build a thenable that resolves to the value
  const thenable = Promise.resolve(resolveValue);
  const chain: Record<string, unknown> = {};
  for (const method of ["from", "where", "orderBy", "limit", "values", "returning"]) {
    chain[method] = vi.fn(() => chain);
  }
  // Make the chain thenable (so await works on it)
  Object.assign(chain, {
    then: thenable.then.bind(thenable),
    catch: thenable.catch.bind(thenable),
    finally: thenable.finally.bind(thenable),
  });
  return chain;
}

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/db/client", () => ({ db: dbMock }));
vi.mock("@/db/schema", () => ({
  researchSessions: { id: "id", userId: "userId", sessionType: "sessionType" },
}));

import { POST } from "@/app/api/research/[[...path]]/route";
import { GET as GETSessions, POST as POSTSessions } from "@/app/api/research/sessions/route";
import { GET as GETSession } from "@/app/api/research/sessions/[id]/route";

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: method !== "GET" ? JSON.stringify(body) : undefined,
  }) as NextRequest;
}

// ── SSE proxy (existing) ──────────────────────────────────────────────────────

describe("POST /api/research/[[...path]]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response('data: {"type":"complete","data":{}}\n\n', {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      })
    );
  });

  it("streams the FastAPI research response through the Next proxy", async () => {
    const response = await POST(jsonRequest("http://test.local/api/research/literature", { query: "burnout" }), {
      params: Promise.resolve({ path: ["literature"] }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(await response.text()).toContain('"type":"complete"');
    expect(global.fetch).toHaveBeenCalledWith(
      "http://ai.example.com/research/literature",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("returns auth failures before calling upstream", async () => {
    const requireAuthMock = routeHelpersMock.requireAuthenticatedApiUser as unknown as {
      mockResolvedValueOnce: (value: unknown) => void;
    };
    requireAuthMock.mockResolvedValueOnce(
      NextResponse.json({ detail: "Unauthorized" }, { status: 401 })
    );

    const response = await POST(jsonRequest("http://test.local/api/research/analysis", { query: "burnout" }), {
      params: Promise.resolve({ path: ["analysis"] }),
    });

    expect(response.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ── GET /api/research/sessions ────────────────────────────────────────────────

describe("GET /api/research/sessions", () => {
  const fakeSessions = [
    {
      id: "sess-1",
      sessionType: "literature",
      query: "burnout",
      status: "complete",
      createdAt: "2026-05-01T10:00:00.000Z",
      completedAt: "2026-05-01T10:01:00.000Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.select.mockReturnValue(makeChainableMock(fakeSessions));
  });

  it("returns 200 with sessions array for authenticated user", async () => {
    const response = await GETSessions();
    const body = await response.json() as { sessions: unknown[] };

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("sessions");
    expect(Array.isArray(body.sessions)).toBe(true);
  });

  it("returns 401 when unauthenticated", async () => {
    (routeHelpersMock.requireAuthenticatedApiUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      NextResponse.json({ detail: "Unauthorized" }, { status: 401 })
    );

    const response = await GETSessions();
    expect(response.status).toBe(401);
  });
});

// ── POST /api/research/sessions ───────────────────────────────────────────────

describe("POST /api/research/sessions", () => {
  const insertedRow = {
    id: "sess-new",
    sessionType: "literature",
    query: "sleep deprivation",
    status: "pending",
    createdAt: "2026-05-13T09:00:00.000Z",
    completedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.insert.mockReturnValue(makeChainableMock([insertedRow]));
  });

  it("inserts a pending session and returns 201 with id", async () => {
    const req = jsonRequest("http://test.local/api/research/sessions", {
      query: "sleep deprivation",
      session_type: "literature",
      industry_ctx: null,
    });

    const response = await POSTSessions(req);
    const body = await response.json() as { id: string; status: string };

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("id");
  });

  it("returns 400 when query is missing", async () => {
    const req = jsonRequest("http://test.local/api/research/sessions", { session_type: "literature" });
    const response = await POSTSessions(req);
    expect(response.status).toBe(422);
  });

  it("returns 401 when unauthenticated", async () => {
    (routeHelpersMock.requireAuthenticatedApiUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      NextResponse.json({ detail: "Unauthorized" }, { status: 401 })
    );

    const req = jsonRequest("http://test.local/api/research/sessions", { query: "test", session_type: "literature" });
    const response = await POSTSessions(req);
    expect(response.status).toBe(401);
  });
});

// ── GET /api/research/sessions/[id] ──────────────────────────────────────────

describe("GET /api/research/sessions/[id]", () => {
  const fakeSession = {
    id: "sess-1",
    userId: "user-1",
    sessionType: "literature",
    query: "burnout",
    status: "complete",
    resultData: { answer: "..." },
    createdAt: "2026-05-01T10:00:00.000Z",
    completedAt: "2026-05-01T10:01:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with session for owner", async () => {
    dbMock.select.mockReturnValue(makeChainableMock([fakeSession]));

    const req = jsonRequest("http://test.local/api/research/sessions/sess-1", {}, "GET");
    const response = await GETSession(req, { params: Promise.resolve({ id: "sess-1" }) });
    const body = await response.json() as { session: { id: string } };

    expect(response.status).toBe(200);
    expect(body.session.id).toBe("sess-1");
  });

  it("returns 404 when session not found or wrong user", async () => {
    dbMock.select.mockReturnValue(makeChainableMock([]));

    const req = jsonRequest("http://test.local/api/research/sessions/nonexistent", {}, "GET");
    const response = await GETSession(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(response.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    (routeHelpersMock.requireAuthenticatedApiUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      NextResponse.json({ detail: "Unauthorized" }, { status: 401 })
    );

    const req = jsonRequest("http://test.local/api/research/sessions/sess-1", {}, "GET");
    const response = await GETSession(req, { params: Promise.resolve({ id: "sess-1" }) });

    expect(response.status).toBe(401);
  });
});


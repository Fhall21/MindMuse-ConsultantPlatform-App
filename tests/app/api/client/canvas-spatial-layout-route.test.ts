import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const clientHelperMocks = vi.hoisted(() => ({
  jsonError: vi.fn((detail: string, status = 500) =>
    NextResponse.json({ detail }, { status })
  ),
  requireRouteClient: vi.fn(async () => ({ userId: "user-1" })),
}));

const ownershipMocks = vi.hoisted(() => ({
  requireOwnedRound: vi.fn(async () => ({ id: "round-1", userId: "user-1" })),
}));

const routeHelperMocks = vi.hoisted(() => ({
  getAiServiceUrlOrResponse: vi.fn(() => "http://ai.example.com"),
}));

vi.mock("@/app/api/client/_helpers", () => clientHelperMocks);
vi.mock("@/lib/data/ownership", () => ownershipMocks);
vi.mock("@/lib/api/route-helpers", () => routeHelperMocks);

import { POST } from "@/app/api/client/consultations/[roundId]/canvas/spatial-layout/route";

function jsonRequest(body: unknown) {
  return new Request("http://test.local/api/client/consultations/round-url/canvas/spatial-layout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function routeContext(roundId = "round-url") {
  return { params: Promise.resolve({ roundId }) };
}

async function callPost(body: unknown, roundId = "round-url"): Promise<Response> {
  return (await POST(jsonRequest(body), routeContext(roundId))) as Response;
}

describe("POST canvas spatial layout proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        NextResponse.json({
          positions: { "node-1": { x: 80, y: 80 } },
          cacheStats: { hits: 0, misses: 3 },
          suggestedFrames: [],
        })
      )
    );
  });

  it("returns 401 when unauthenticated", async () => {
    clientHelperMocks.requireRouteClient.mockResolvedValueOnce({
      response: NextResponse.json({ detail: "Unauthorized" }, { status: 401 }),
    } as never);

    const response = await callPost({ nodes: [] });

    expect(response.status).toBe(401);
    expect(ownershipMocks.requireOwnedRound).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns 403 when the user does not own the round", async () => {
    ownershipMocks.requireOwnedRound.mockRejectedValueOnce(new Error("Round not found"));

    const response = await callPost({ nodes: validNodes() });

    expect(response.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns 422 for malformed body", async () => {
    const response = await callPost({ nodes: [{ id: "node-1" }] });

    expect(response.status).toBe(422);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("validates node count before proxying", async () => {
    const response = await callPost({ nodes: validNodes().slice(0, 2) });

    expect(response.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("injects URL roundId and ignores body roundId", async () => {
    const response = await callPost({ roundId: "body-round", nodes: validNodes() }, "url-round");

    expect(response.status).toBe(200);
    expect(ownershipMocks.requireOwnedRound).toHaveBeenCalledWith("url-round", "user-1");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://ai.example.com/canvas/spatial-layout",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId: "url-round", nodes: validNodes() }),
      })
    );
  });

  it("propagates upstream JSON status and body", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      NextResponse.json({ detail: "busy" }, { status: 503 })
    );

    const response = await callPost({ nodes: validNodes() });
    const body = (await response.json()) as { detail: string };

    expect(response.status).toBe(503);
    expect(body.detail).toBe("busy");
  });
});

function validNodes() {
  return [
    { id: "node-1", text: "one" },
    { id: "node-2", text: "two" },
    { id: "node-3", text: "three" },
  ];
}

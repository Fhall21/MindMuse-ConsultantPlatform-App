import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routeHelpersMock = vi.hoisted(() => ({
  getAiServiceUrlOrResponse: vi.fn(() => "http://ai.example.com"),
  requireAuthenticatedApiUser: vi.fn(async () => ({ id: "user-1" })),
}));

vi.mock("@/lib/api/route-helpers", () => routeHelpersMock);

import { POST } from "@/app/api/research/[[...path]]/route";

function jsonRequest(body: unknown) {
  return new Request("http://test.local/api/research/literature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest;
}

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
    const response = await POST(jsonRequest({ query: "burnout" }), {
      params: Promise.resolve({ path: ["literature"] }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(await response.text()).toContain('"type":"complete"');
    expect(global.fetch).toHaveBeenCalledWith(
      "http://ai.example.com/research/literature",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("returns auth failures before calling upstream", async () => {
    const requireAuthMock = routeHelpersMock.requireAuthenticatedApiUser as unknown as {
      mockResolvedValueOnce: (value: unknown) => void;
    };
    requireAuthMock.mockResolvedValueOnce(
      NextResponse.json({ detail: "Unauthorized" }, { status: 401 })
    );

    const response = await POST(jsonRequest({ query: "burnout" }), {
      params: Promise.resolve({ path: ["analysis"] }),
    });

    expect(response.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

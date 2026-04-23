import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const digitalInterviewMock = vi.hoisted(() => ({
  getPublicDigitalInterviewFlow: vi.fn(),
  createOrResumeDigitalInterviewSession: vi.fn(),
  appendDigitalInterviewMessage: vi.fn(),
  completeDigitalInterviewSession: vi.fn(),
}));

vi.mock("@/lib/data/digital-interviews", async () => ({
  ...(await vi.importActual<typeof import("@/lib/data/digital-interviews")>(
    "@/lib/data/digital-interviews"
  )),
  ...digitalInterviewMock,
}));

import { GET as GETPublicDigitalInterviewFlow } from "@/app/api/public/digital-interviews/[shareToken]/route";
import { POST as POSTDigitalInterviewSession } from "@/app/api/public/digital-interviews/[shareToken]/session/route";
import { POST as POSTDigitalInterviewMessage } from "@/app/api/public/digital-interviews/[shareToken]/session/[sessionToken]/message/route";
import { POST as POSTDigitalInterviewComplete } from "@/app/api/public/digital-interviews/[shareToken]/session/[sessionToken]/complete/route";

function jsonRequest(url: string, body?: unknown) {
  return new Request(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe("digital interview public routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns public flow without auth", async () => {
    digitalInterviewMock.getPublicDigitalInterviewFlow.mockResolvedValue({ id: "flow-1" });

    const response = (await GETPublicDigitalInterviewFlow(jsonRequest("http://test") as NextRequest, {
      params: Promise.resolve({ shareToken: "share-1" }),
    })) as Response;

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({ data: { id: "flow-1" } });
  });

  it("creates or resumes session", async () => {
    digitalInterviewMock.createOrResumeDigitalInterviewSession.mockResolvedValue({ session_token: "session-1" });

    const response = (await POSTDigitalInterviewSession(
      jsonRequest("http://test", { sessionToken: "8e5c1dc0-2b8a-4dfb-8f1f-2d1c3d1a0001" }) as NextRequest,
      { params: Promise.resolve({ shareToken: "share-1" }) }
    )) as Response;

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({ data: { session_token: "session-1" } });
  });

  it("appends message", async () => {
    digitalInterviewMock.appendDigitalInterviewMessage.mockResolvedValue({ session_token: "session-1" });

    const response = (await POSTDigitalInterviewMessage(
      jsonRequest("http://test", { role: "assistant", content: "Next question" }) as NextRequest,
      { params: Promise.resolve({ shareToken: "share-1", sessionToken: "session-1" }) }
    )) as Response;

    expect(response.status).toBe(200);
  });

  it("completes session", async () => {
    digitalInterviewMock.completeDigitalInterviewSession.mockResolvedValue({ session_token: "session-1" });

    const response = (await POSTDigitalInterviewComplete(jsonRequest("http://test") as NextRequest, {
      params: Promise.resolve({ shareToken: "share-1", sessionToken: "session-1" }),
    })) as Response;

    expect(response.status).toBe(200);
  });
});

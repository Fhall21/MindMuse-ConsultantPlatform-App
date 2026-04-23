import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const digitalInterviewMock = vi.hoisted(() => ({
  getPublicDigitalInterviewFlow: vi.fn(),
  createOrResumeDigitalInterviewSession: vi.fn(),
  updateDigitalInterviewSessionDetails: vi.fn(),
  appendDigitalInterviewMessage: vi.fn(),
  completeDigitalInterviewSession: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: {},
}));
vi.mock("@/app/api/client/_helpers", () => ({
  jsonError: (detail: string, status = 500) => new Response(JSON.stringify({ detail }), { status }),
}));
vi.mock("@/lib/api/route-helpers", () => ({
  parseJsonBodyOrResponse: async (request: Request) => request.json(),
}));
vi.mock("@/lib/data/digital-interviews", () => ({
  digitalInterviewSessionCreateSchema: z.object({
    sessionToken: z.string().uuid().optional().nullable(),
  }),
  digitalInterviewMessageSchema: z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1),
    timestamp: z.string().datetime().optional(),
  }),
  digitalInterviewSessionDetailsSchema: z.object({
    name: z.string().trim().min(1),
    role: z.string().trim().min(1),
    workGroup: z.string().trim().min(1),
    organisation: z.string().trim().min(1),
    email: z.string().trim().email().optional().nullable(),
  }),
  ...digitalInterviewMock,
}));

import { GET as GETPublicDigitalInterviewFlow } from "@/app/api/public/digital-interviews/[shareToken]/route";
import { POST as POSTDigitalInterviewSession } from "@/app/api/public/digital-interviews/[shareToken]/session/route";
import { PATCH as PATCHDigitalInterviewSessionDetails } from "@/app/api/public/digital-interviews/[shareToken]/session/[sessionToken]/details/route";
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

  it("returns 404 when the public flow is missing", async () => {
    digitalInterviewMock.getPublicDigitalInterviewFlow.mockResolvedValue(null);

    const response = (await GETPublicDigitalInterviewFlow(jsonRequest("http://test") as NextRequest, {
      params: Promise.resolve({ shareToken: "share-1" }),
    })) as Response;

    expect(response.status).toBe(404);
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

  it("saves onboarding details for a session", async () => {
    digitalInterviewMock.updateDigitalInterviewSessionDetails.mockResolvedValue({
      session_token: "session-1",
      interviewee_name: "Alex",
    });

    const response = (await PATCHDigitalInterviewSessionDetails(
      jsonRequest("http://test", {
        name: "Alex",
        role: "Manager",
        work_group: "Operations",
        organisation: "Example Org",
        email: "alex@example.com",
      }) as NextRequest,
      { params: Promise.resolve({ shareToken: "share-1", sessionToken: "session-1" }) }
    )) as Response;

    expect(response.status).toBe(200);
    expect(digitalInterviewMock.updateDigitalInterviewSessionDetails).toHaveBeenCalledWith({
      shareToken: "share-1",
      sessionToken: "session-1",
      details: {
        name: "Alex",
        role: "Manager",
        workGroup: "Operations",
        organisation: "Example Org",
        email: "alex@example.com",
      },
    });
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

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const digitalInterviewMock = vi.hoisted(() => ({
  getPublicDigitalInterviewFlow: vi.fn(),
  createOrResumeDigitalInterviewSession: vi.fn(),
  getPublicDigitalInterviewSessionContext: vi.fn(),
  updateDigitalInterviewSessionDetails: vi.fn(),
  appendDigitalInterviewMessage: vi.fn(),
  completeDigitalInterviewSession: vi.fn(),
  formatInterviewSessionTurn: vi.fn((content: string, role: "user" | "assistant") => ({
    role,
    content,
    timestamp: "2026-04-23T10:00:00.000Z",
  })),
}));

vi.mock("@/db/client", () => ({
  db: {},
}));
vi.mock("@/app/api/client/_helpers", () => ({
  jsonError: (detail: string, status = 500) => new Response(JSON.stringify({ detail }), { status }),
}));
vi.mock("@/lib/api/route-helpers", () => ({
  parseJsonBodyOrResponse: async (request: Request) => request.json(),
  getAiServiceUrlOrResponse: () => "http://ai.example.com",
  forwardJsonToAi: vi.fn(async () =>
    new Response(
      JSON.stringify({
        assistantMessage: "Tell me more about workload.",
        isComplete: false,
        topicsCovered: [],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  ),
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
import { POST as POSTDigitalInterviewChat } from "@/app/api/public/digital-interviews/[shareToken]/session/[sessionToken]/chat/route";
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

  it("routes interview chat to the AI service and persists the response", async () => {
    digitalInterviewMock.getPublicDigitalInterviewSessionContext.mockResolvedValue({
      flow: {
        id: "flow-1",
        title: "Digital interview",
        framework: "appreciative_inquiry",
        custom_framework_prompt: null,
        topics: ["Workload", "Support"],
        depth_level: "moderate",
        status: "active",
      },
      session: {
        id: "response-1",
        flow_id: "flow-1",
        session_token: "session-1",
        interviewee_name: "Alex",
        interviewee_email: null,
        interviewee_role: "Manager",
        interviewee_work_group: "Operations",
        interviewee_organisation: "Example Org",
        person_id: null,
        person_match_confidence: null,
        conversation_history: [
          {
            role: "assistant",
            content: "Hello Alex, I’m going to ask about your experience at work.",
            timestamp: "2026-04-23T09:59:00.000Z",
          },
        ],
        status: "in_progress",
        completed_at: null,
        created_at: "2026-04-23T10:00:00.000Z",
        updated_at: "2026-04-23T10:00:00.000Z",
      },
    });

    digitalInterviewMock.appendDigitalInterviewMessage.mockResolvedValue({ session_token: "session-1" });

    const response = (await POSTDigitalInterviewChat(
      jsonRequest("http://test", { userMessage: "Things have been busy lately." }) as NextRequest,
      { params: Promise.resolve({ shareToken: "share-1", sessionToken: "session-1" }) }
    )) as Response;

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({
      assistantMessage: "Tell me more about workload.",
      isComplete: false,
      topicsProgress: [
        { topic: "Workload", covered: false },
        { topic: "Support", covered: false },
      ],
    });

    expect(digitalInterviewMock.formatInterviewSessionTurn).toHaveBeenCalledWith(
      "Things have been busy lately.",
      "user"
    );
    expect(digitalInterviewMock.appendDigitalInterviewMessage).toHaveBeenCalledTimes(2);
    expect(digitalInterviewMock.completeDigitalInterviewSession).not.toHaveBeenCalled();
  });

  it("closes the interview when the agent completes the tool call", async () => {
    digitalInterviewMock.getPublicDigitalInterviewSessionContext.mockResolvedValue({
      flow: {
        id: "flow-1",
        title: "Digital interview",
        framework: "psychological_safety",
        custom_framework_prompt: null,
        topics: ["Speak up", "Support"],
        depth_level: "deep",
        status: "active",
      },
      session: {
        id: "response-1",
        flow_id: "flow-1",
        session_token: "session-1",
        interviewee_name: "Alex",
        interviewee_email: null,
        interviewee_role: "Manager",
        interviewee_work_group: "Operations",
        interviewee_organisation: "Example Org",
        person_id: null,
        person_match_confidence: null,
        conversation_history: [],
        status: "in_progress",
        completed_at: null,
        created_at: "2026-04-23T10:00:00.000Z",
        updated_at: "2026-04-23T10:00:00.000Z",
      },
    });

    const forwardJsonToAi = (await import("@/lib/api/route-helpers")).forwardJsonToAi as ReturnType<
      typeof vi.fn
    >;
    forwardJsonToAi.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          assistantMessage: "Thank you, Alex.",
          isComplete: true,
          topicsCovered: ["Speak up", "Support"],
          coverageNote: "All topics covered at deep depth.",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    digitalInterviewMock.completeDigitalInterviewSession.mockResolvedValue({ session_token: "session-1" });
    digitalInterviewMock.appendDigitalInterviewMessage.mockResolvedValue({ session_token: "session-1" });

    const response = (await POSTDigitalInterviewChat(
      jsonRequest("http://test", { userMessage: "I don’t always feel able to raise issues." }) as NextRequest,
      { params: Promise.resolve({ shareToken: "share-1", sessionToken: "session-1" }) }
    )) as Response;

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({
      assistantMessage:
        "Thank you, Alex. That's all I need for today. Your responses have been recorded and will be reviewed by the consultant. This conversation has now closed.",
      isComplete: true,
      topicsProgress: [
        { topic: "Speak up", covered: true },
        { topic: "Support", covered: true },
      ],
    });
    expect(digitalInterviewMock.completeDigitalInterviewSession).toHaveBeenCalledWith({
      shareToken: "share-1",
      sessionToken: "session-1",
    });
  });

  it("returns 409 when the interview session is already completed", async () => {
    digitalInterviewMock.getPublicDigitalInterviewSessionContext.mockResolvedValue({
      flow: {
        id: "flow-1",
        title: "Digital interview",
        framework: "appreciative_inquiry",
        custom_framework_prompt: null,
        topics: ["Workload"],
        depth_level: "moderate",
        status: "active",
      },
      session: {
        id: "response-1",
        flow_id: "flow-1",
        session_token: "session-1",
        interviewee_name: "Alex",
        interviewee_email: null,
        interviewee_role: "Manager",
        interviewee_work_group: "Operations",
        interviewee_organisation: "Example Org",
        person_id: null,
        person_match_confidence: null,
        conversation_history: [],
        status: "completed",
        completed_at: "2026-04-23T10:10:00.000Z",
        created_at: "2026-04-23T10:00:00.000Z",
        updated_at: "2026-04-23T10:10:00.000Z",
      },
    });

    const response = (await POSTDigitalInterviewChat(
      jsonRequest("http://test", { userMessage: "Hello" }) as NextRequest,
      { params: Promise.resolve({ shareToken: "share-1", sessionToken: "session-1" }) }
    )) as Response;

    expect(response.status).toBe(409);
    await expect(readJson(response)).resolves.toEqual({
      detail: "This interview has already been completed.",
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

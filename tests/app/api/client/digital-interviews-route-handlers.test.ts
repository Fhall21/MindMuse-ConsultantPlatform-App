import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authContextMock = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

const digitalInterviewMock = vi.hoisted(() => ({
  listDigitalInterviewFlowsForUser: vi.fn(),
  createDigitalInterviewFlow: vi.fn(),
  getDigitalInterviewFlowDetailForUser: vi.fn(),
  updateDigitalInterviewFlowStatus: vi.fn(),
  closeDigitalInterviewFlow: vi.fn(),
  countUnreadDigitalInterviewCompletionsForUser: vi.fn(),
}));

vi.mock("@/lib/data/auth-context", () => authContextMock);
vi.mock("@/lib/data/digital-interviews", async () => ({
  ...(await vi.importActual<typeof import("@/lib/data/digital-interviews")>(
    "@/lib/data/digital-interviews"
  )),
  ...digitalInterviewMock,
}));

import { GET as GETDigitalInterviewFlow, PATCH as PATCHDigitalInterviewFlow, DELETE as DELETEDigitalInterviewFlow } from "@/app/api/client/digital-interviews/[flowId]/route";
import { GET as GETDigitalInterviews, POST as POSTDigitalInterviews } from "@/app/api/client/digital-interviews/route";
import { GET as GETUnreadDigitalInterviewCount } from "@/app/api/client/digital-interviews/unread-count/route";

function jsonRequest(url: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
  return new Request(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe("digital interview client routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authContextMock.getCurrentUserId.mockResolvedValue("user-1");
  });

  it("blocks list when unauthenticated", async () => {
    authContextMock.getCurrentUserId.mockResolvedValue(null);

    const response = (await GETDigitalInterviews()) as Response;

    expect(response.status).toBe(401);
  });

  it("lists digital interviews for user", async () => {
    digitalInterviewMock.listDigitalInterviewFlowsForUser.mockResolvedValue([{ id: "flow-1" }]);

    const response = (await GETDigitalInterviews()) as Response;

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({ data: [{ id: "flow-1" }] });
  });

  it("creates digital interview", async () => {
    digitalInterviewMock.createDigitalInterviewFlow.mockResolvedValue({ id: "flow-1" });

    const response = (await POSTDigitalInterviews(
      jsonRequest("http://test", {
        title: "Interview",
        framework: "care",
        topics: ["Workload"],
        depthLevel: "moderate",
      }) as NextRequest
    )) as Response;

    expect(response.status).toBe(201);
    await expect(readJson(response)).resolves.toEqual({ data: { id: "flow-1" } });
  });

  it("returns flow detail", async () => {
    digitalInterviewMock.getDigitalInterviewFlowDetailForUser.mockResolvedValue({
      id: "flow-1",
      responses: [],
    });

    const response = (await GETDigitalInterviewFlow(jsonRequest("http://test") as NextRequest, {
      params: Promise.resolve({ flowId: "flow-1" }),
    })) as Response;

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({ data: { id: "flow-1", responses: [] } });
  });

  it("updates flow status", async () => {
    digitalInterviewMock.updateDigitalInterviewFlowStatus.mockResolvedValue({ id: "flow-1" });

    const response = (await PATCHDigitalInterviewFlow(
      jsonRequest("http://test", { status: "active" }, "PATCH") as NextRequest,
      { params: Promise.resolve({ flowId: "flow-1" }) }
    )) as Response;

    expect(response.status).toBe(200);
  });

  it("deletes flow as close", async () => {
    digitalInterviewMock.closeDigitalInterviewFlow.mockResolvedValue({ id: "flow-1" });

    const response = (await DELETEDigitalInterviewFlow(
      jsonRequest("http://test", undefined, "DELETE") as NextRequest,
      { params: Promise.resolve({ flowId: "flow-1" }) }
    )) as Response;

    expect(response.status).toBe(204);
  });

  it("returns unread count", async () => {
    digitalInterviewMock.countUnreadDigitalInterviewCompletionsForUser.mockResolvedValue(12);

    const response = (await GETUnreadDigitalInterviewCount()) as Response;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toBe(12);
  });
});

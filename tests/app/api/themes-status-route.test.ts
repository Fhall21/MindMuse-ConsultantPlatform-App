import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.hoisted(() => ({
  requireAuthenticatedApiUser: vi.fn(),
}));

const contextMock = vi.hoisted(() => ({
  getUnarchivedSessionForUser: vi.fn(),
}));

const themesDbMock = vi.hoisted(() => ({
  acceptInsightForMeeting: vi.fn(),
  rejectInsightForMeeting: vi.fn(),
  mergeThemeDecision: vi.fn((output, id, decision) => ({
    ...output,
    decisions: { ...output.decisions, [id]: decision },
  })),
  hasAnyAcceptedDecision: vi.fn(() => false),
}));

const persistMock = vi.hoisted(() => ({
  getToolResultForSession: vi.fn(),
  updateToolResult: vi.fn(),
}));

const onboardingMock = vi.hoisted(() => ({
  recordOnboardingMilestone: vi.fn(),
}));

vi.mock("@/lib/api/route-helpers", () => authMock);
vi.mock("@/lib/chat/context", () => contextMock);
vi.mock("@/lib/chat/themes-db", () => themesDbMock);
vi.mock("@/lib/chat/persist", () => persistMock);
vi.mock("@/lib/chat/onboarding-state", () => onboardingMock);

import { PATCH } from "@/app/api/themes/[id]/status/route";

const meetingId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const toolResultId = "33333333-3333-4333-8333-333333333333";
const insightId = "44444444-4444-4444-8444-444444444444";

describe("PATCH /api/themes/[id]/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.requireAuthenticatedApiUser.mockResolvedValue({ id: "user-1" });
    contextMock.getUnarchivedSessionForUser.mockResolvedValue({ id: sessionId });
    persistMock.getToolResultForSession.mockResolvedValue({
      id: toolResultId,
      output: {
        meeting_id: meetingId,
        themes: [
          {
            id: insightId,
            label: "Theme",
            description: "Desc",
            source_quotes: [],
            confidence: 0.7,
          },
        ],
        decisions: {},
      },
    });
    persistMock.updateToolResult.mockResolvedValue({});
  });

  it("accepts an insight and records onboarding milestone on first accept", async () => {
    const request = new NextRequest("http://localhost/api/themes/x/status", {
      method: "PATCH",
      body: JSON.stringify({
        meeting_id: meetingId,
        status: "accepted",
        session_id: sessionId,
        tool_result_id: toolResultId,
      }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: insightId }),
    });

    expect(response.status).toBe(200);
    expect(themesDbMock.acceptInsightForMeeting).toHaveBeenCalledWith({
      userId: "user-1",
      meetingId,
      insightId,
    });
    expect(onboardingMock.recordOnboardingMilestone).toHaveBeenCalledWith(
      "user-1",
      sessionId,
      "insight_accept"
    );
  });

  it("returns 404 when chat session is not owned", async () => {
    contextMock.getUnarchivedSessionForUser.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/themes/x/status", {
      method: "PATCH",
      body: JSON.stringify({
        meeting_id: meetingId,
        status: "accepted",
        session_id: sessionId,
      }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: insightId }),
    });

    expect(response.status).toBe(404);
  });
});

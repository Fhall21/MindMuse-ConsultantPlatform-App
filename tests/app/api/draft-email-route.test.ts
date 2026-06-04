import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routeHelpersMock = vi.hoisted(() => ({
  forwardJsonToAi: vi.fn(async (_url: string, _path: string, body: unknown) =>
    NextResponse.json({ ok: true, echoed: body })
  ),
  getAiServiceUrlOrResponse: vi.fn(() => "http://ai.example.com"),
  parseJsonBodyOrResponse: vi.fn(async (request: Request) => request.json()),
  requireAuthenticatedApiUser: vi.fn(async () => ({ id: "user-1" })),
}));

const aiLearningsMock = vi.hoisted(() => ({
  loadUserAILearnings: vi.fn(async () => [
    {
      id: "learning-1",
      user_id: "user-1",
      topic_type: "theme_generation",
      learning_type: "trend",
      label: "Return to work barriers",
      description: "Often useful when employer friction appears.",
      supporting_metrics: {},
      created_at: "2026-04-30T10:00:00.000Z",
      expires_at: null,
      version: 1,
    },
  ]),
}));

const themeLearningMock = vi.hoisted(() => ({
  loadRecentThemeLearningSignals: vi.fn(async () => [
    {
      label: "Return to work barriers",
      decision_type: "accept",
      rationale: null,
      weight: 1,
    },
  ]),
}));

const preferencesMock = vi.hoisted(() => ({
  loadUserAIPreferences: vi.fn(async () => ({
    consultation_types: ["return to work assessment"],
    focus_areas: ["workload"],
    excluded_topics: ["small talk"],
    email_guidance: "Keep the draft concise and action-led.",
  })),
}));

vi.mock("@/lib/api/route-helpers", () => routeHelpersMock);
vi.mock("@/lib/data/ai-learnings", () => aiLearningsMock);
vi.mock("@/lib/data/theme-learning", () => themeLearningMock);
vi.mock("@/lib/data/user-ai-preferences", () => preferencesMock);

import { POST } from "@/app/api/draft/email/route";

function jsonRequest(body: unknown) {
  return new Request("http://test.local/api/draft/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest;
}

describe("POST /api/draft/email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards personalization context with the email draft request", async () => {
    const response = (await POST(
      jsonRequest({
        transcript: "The consultant discussed workload and follow-up actions.",
        themes: ["Workload pressure"],
        people: ["Alex"],
        previous_draft_subject: "Earlier follow-up",
        previous_draft_body: "Earlier body with too much detail.",
      })
    )) as Response;

    expect(response.status).toBe(200);
    expect(themeLearningMock.loadRecentThemeLearningSignals).toHaveBeenCalledTimes(1);
    expect(aiLearningsMock.loadUserAILearnings).toHaveBeenCalledWith("user-1");
    expect(preferencesMock.loadUserAIPreferences).toHaveBeenCalledTimes(1);

    expect(routeHelpersMock.forwardJsonToAi).toHaveBeenCalledWith(
      "http://ai.example.com",
      "/draft/email",
      expect.objectContaining({
        transcript: "The consultant discussed workload and follow-up actions.",
        learning_signals: expect.arrayContaining([
          expect.objectContaining({ label: "Return to work barriers" }),
        ]),
        ai_learnings: expect.arrayContaining([
          expect.objectContaining({ id: "learning-1" }),
        ]),
        user_preferences: expect.objectContaining({
          consultation_types: ["return to work assessment"],
          email_guidance: "Keep the draft concise and action-led.",
        }),
        previous_draft_subject: "Earlier follow-up",
        previous_draft_body: "Earlier body with too much detail.",
      }),
      { userId: "user-1" }
    );
  });

  it("falls back to empty personalization context if loading fails", async () => {
    themeLearningMock.loadRecentThemeLearningSignals.mockRejectedValueOnce(
      new Error("boom")
    );

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await POST(
      jsonRequest({
        transcript: "Transcript",
        themes: ["Theme"],
        people: ["Alex"],
      })
    );

    expect(routeHelpersMock.forwardJsonToAi).toHaveBeenCalledWith(
      "http://ai.example.com",
      "/draft/email",
      expect.objectContaining({
        learning_signals: [],
        ai_learnings: [],
        user_preferences: null,
      }),
      { userId: "user-1" }
    );

    errorSpy.mockRestore();
  });
});

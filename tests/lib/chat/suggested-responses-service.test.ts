import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MEETING_SAVED_FOLLOW_UP,
  THEME_REVIEW_DONE_FOLLOW_UP,
} from "@/lib/chat/onboarding-copy";

const {
  getChatMessageForSessionMock,
  loadRecentChatMessagesMock,
  sessionTurnIncludesCardToolMock,
  updateChatMessageMetadataMock,
} = vi.hoisted(() => ({
  getChatMessageForSessionMock: vi.fn(),
  loadRecentChatMessagesMock: vi.fn(),
  sessionTurnIncludesCardToolMock: vi.fn(),
  updateChatMessageMetadataMock: vi.fn(),
}));

vi.mock("@/lib/chat/card-tools", () => ({
  sessionTurnIncludesCardTool: sessionTurnIncludesCardToolMock,
}));

vi.mock("@/lib/chat/persist", () => ({
  getChatMessageForSession: getChatMessageForSessionMock,
  loadRecentChatMessages: loadRecentChatMessagesMock,
  updateChatMessageMetadata: updateChatMessageMetadataMock,
}));

import type { loadRecentChatMessages } from "@/lib/chat/persist";
import {
  canGenerateSuggestedResponsesForTurn,
  ensureSuggestedResponsesForAssistantMessage,
} from "@/lib/chat/suggested-responses-service";
import { getWorkflowSuggestedResponsesForContent } from "@/lib/chat/suggested-response-templates";

type StoredMessage = Awaited<ReturnType<typeof loadRecentChatMessages>>[number];

describe("lib/chat/suggested-responses-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionTurnIncludesCardToolMock.mockResolvedValue(false);
    loadRecentChatMessagesMock.mockResolvedValue([]);
    getChatMessageForSessionMock.mockResolvedValue({
      id: "assistant-1",
      role: "assistant",
      content: THEME_REVIEW_DONE_FOLLOW_UP,
      metadata: null,
    });
    updateChatMessageMetadataMock.mockResolvedValue(undefined);
  });

  it("allows known workflow follow-ups even when a pending card is in the turn", async () => {
    sessionTurnIncludesCardToolMock.mockResolvedValue(true);

    await expect(
      canGenerateSuggestedResponsesForTurn({
        sessionId: "session-1",
        assistantText: MEETING_SAVED_FOLLOW_UP,
        messagesAfterTurn: [{ role: "tool", content: "{}" }] as StoredMessage[],
      })
    ).resolves.toBe(true);
  });

  it("persists workflow template chips without sidecar LLM", async () => {
    const result = await ensureSuggestedResponsesForAssistantMessage({
      sessionId: "session-1",
      messageId: "assistant-1",
      assistantText: THEME_REVIEW_DONE_FOLLOW_UP,
    });

    expect(result?.source).toBe("workflow");
    expect(result?.options[0]?.label).toBe("Identify quotes");
    expect(updateChatMessageMetadataMock).toHaveBeenCalledOnce();
  });

  it("workflow payloads are displayable for meeting and theme saved copy", () => {
    const meeting = getWorkflowSuggestedResponsesForContent(MEETING_SAVED_FOLLOW_UP);
    const theme = getWorkflowSuggestedResponsesForContent(THEME_REVIEW_DONE_FOLLOW_UP);

    expect(meeting?.source).toBe("workflow");
    expect(meeting?.options).toHaveLength(3);
    expect(theme?.options[0]?.prefill).toContain("identify supporting quotes");
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  maybeInsertCardCompletionFollowUp,
  resolveCardCompletionFollowUp,
} from "@/lib/chat/card-completion-follow-up";
import {
  QUOTE_REVIEW_DONE_FOLLOW_UP,
  THEME_REVIEW_DONE_FOLLOW_UP,
} from "@/lib/chat/onboarding-copy";

const insertChatMessage = vi.fn();

vi.mock("@/lib/chat/persist", () => ({
  insertChatMessage: (...args: unknown[]) => insertChatMessage(...args),
}));

const themeReviewOutput = {
  meeting_id: "11111111-1111-4111-8111-111111111111",
  themes: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      label: "Trust",
      description: "Participants discussed trust.",
      source_quotes: ["We talked about trust."],
      confidence: 0.9,
    },
  ],
  decisions: {
    "22222222-2222-4222-8222-222222222222": "accepted" as const,
  },
};

const quoteReviewOutput = {
  meeting_id: "11111111-1111-4111-8111-111111111111",
  quotes: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      text: "We need more clarity.",
      theme_id: "22222222-2222-4222-8222-222222222222",
      theme_label: "Trust",
      span_start: 10,
      span_end: 30,
    },
  ],
  decisions: {
    "33333333-3333-4333-8333-333333333333": "accepted" as const,
  },
  db_quote_ids: {},
};

const showQuotesOutput = {
  meeting_id: "11111111-1111-4111-8111-111111111111",
  meeting_title: "Chris follow-up",
};

describe("resolveCardCompletionFollowUp", () => {
  it("returns theme follow-up for completed extract_themes cards", () => {
    expect(resolveCardCompletionFollowUp("extract_themes", themeReviewOutput)).toBe(
      THEME_REVIEW_DONE_FOLLOW_UP
    );
  });

  it("returns quote follow-up for completed identify_quotes cards", () => {
    expect(resolveCardCompletionFollowUp("identify_quotes", quoteReviewOutput)).toBe(
      QUOTE_REVIEW_DONE_FOLLOW_UP
    );
  });

  it("returns quote follow-up for completed manual show_quotes cards", () => {
    expect(resolveCardCompletionFollowUp("show_quotes", showQuotesOutput)).toBe(
      QUOTE_REVIEW_DONE_FOLLOW_UP
    );
  });

  it("returns null for unsupported tools", () => {
    expect(resolveCardCompletionFollowUp("select_meeting_for_themes", {})).toBeNull();
  });

  it("returns confirmation for saved research questions", () => {
    expect(resolveCardCompletionFollowUp("generate_research_questions", {})).toContain(
      "Research questions saved"
    );
  });
});

describe("maybeInsertCardCompletionFollowUp", () => {
  beforeEach(() => {
    insertChatMessage.mockReset();
  });

  it("inserts assistant follow-up when a card transitions to success", async () => {
    await maybeInsertCardCompletionFollowUp({
      sessionId: "44444444-4444-4444-8444-444444444444",
      toolName: "extract_themes",
      previousStatus: "pending",
      nextStatus: "success",
      output: themeReviewOutput,
    });

    expect(insertChatMessage).toHaveBeenCalledWith({
      sessionId: "44444444-4444-4444-8444-444444444444",
      role: "assistant",
      content: THEME_REVIEW_DONE_FOLLOW_UP,
    });
  });

  it("inserts assistant follow-up when manual quote review is done", async () => {
    await maybeInsertCardCompletionFollowUp({
      sessionId: "44444444-4444-4444-8444-444444444444",
      toolName: "show_quotes",
      previousStatus: "pending",
      nextStatus: "success",
      output: showQuotesOutput,
    });

    expect(insertChatMessage).toHaveBeenCalledWith({
      sessionId: "44444444-4444-4444-8444-444444444444",
      role: "assistant",
      content: QUOTE_REVIEW_DONE_FOLLOW_UP,
    });
  });

  it("does not insert when status was already success", async () => {
    await maybeInsertCardCompletionFollowUp({
      sessionId: "44444444-4444-4444-8444-444444444444",
      toolName: "extract_themes",
      previousStatus: "success",
      nextStatus: "success",
      output: themeReviewOutput,
    });

    expect(insertChatMessage).not.toHaveBeenCalled();
  });

  it("does not insert for pending partial updates", async () => {
    await maybeInsertCardCompletionFollowUp({
      sessionId: "44444444-4444-4444-8444-444444444444",
      toolName: "extract_themes",
      previousStatus: "pending",
      nextStatus: "pending",
      output: themeReviewOutput,
    });

    expect(insertChatMessage).not.toHaveBeenCalled();
  });
});

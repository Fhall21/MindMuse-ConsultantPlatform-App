import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import {
  MEETING_SAVED_FOLLOW_UP,
  THEME_REVIEW_DONE_FOLLOW_UP,
} from "@/lib/chat/onboarding-copy";
import { getWorkflowSuggestedResponsesForContent } from "@/lib/chat/suggested-response-templates";
import {
  areSuggestedOptionsTooSimilar,
  areSuggestedResponsesStale,
  filterDisplayableOptions,
  getSuggestedResponsesAnchorMessageId,
  getVisibleSuggestedResponseOptions,
  invitesReplyHeuristic,
  normalizeSuggestedResponsesPayload,
  rejectSemanticallyRedundantOptions,
  shouldDisplaySuggestedResponses,
  shouldHideSuggestedResponses,
  suggestedResponsesPayloadSchema,
  type GenerativeSuggestedResponseOption,
  type SuggestedResponseOption,
  type SuggestedResponsesPayload,
} from "@/lib/chat/suggested-responses";

describe("lib/chat/suggested-responses", () => {
  it("parses valid generative and workflow payload schemas", () => {
    const generative = suggestedResponsesPayloadSchema.parse({
      source: "generative",
      overallConfidence: 0.85,
      options: [
        { label: "Yes, extract", prefill: "Yes, extract themes from the transcript", confidence: 0.9 },
      ],
    });
    expect(generative.options).toHaveLength(1);

    const workflow = suggestedResponsesPayloadSchema.parse({
      source: "workflow",
      options: [{ label: "Go", prefill: "Go ahead", role: "primary" }],
    });
    expect(workflow.source).toBe("workflow");
  });

  it("invitesReplyHeuristic matches invite patterns", () => {
    expect(invitesReplyHeuristic("Meeting saved. Want to extract themes?")).toBe(true);
    expect(invitesReplyHeuristic("Say when you're ready.")).toBe(true);
    expect(invitesReplyHeuristic(MEETING_SAVED_FOLLOW_UP)).toBe(true);
    expect(invitesReplyHeuristic(THEME_REVIEW_DONE_FOLLOW_UP)).toBe(true);
    expect(invitesReplyHeuristic("Shall I group these themes now?")).toBe(true);
    expect(invitesReplyHeuristic("Here is the summary of your consultation.")).toBe(false);
  });

  it("recognizes workflow follow-up templates for deterministic chips", () => {
    expect(getWorkflowSuggestedResponsesForContent(MEETING_SAVED_FOLLOW_UP)?.source).toBe(
      "workflow"
    );
    expect(getWorkflowSuggestedResponsesForContent(MEETING_SAVED_FOLLOW_UP)?.options[0]?.label).toBe(
      "Extract themes"
    );
    expect(getWorkflowSuggestedResponsesForContent(THEME_REVIEW_DONE_FOLLOW_UP)?.options[0]?.label).toBe(
      "Identify quotes"
    );
  });

  it("shouldDisplaySuggestedResponses enforces generative thresholds and workflow role dedupe", () => {
    const high: SuggestedResponsesPayload = {
      source: "generative",
      overallConfidence: 0.8,
      options: [
        { label: "Proceed", prefill: "Yes, proceed", confidence: 0.7 },
        { label: "Not now", prefill: "Not now", confidence: 0.68 },
      ],
    };
    expect(shouldDisplaySuggestedResponses(high)).toBe(true);

    const lowOverall: SuggestedResponsesPayload = {
      source: "generative",
      overallConfidence: 0.7,
      options: [{ label: "Yes", prefill: "Yes", confidence: 0.9 }],
    };
    expect(shouldDisplaySuggestedResponses(lowOverall)).toBe(false);

    const lowOptions: SuggestedResponsesPayload = {
      source: "generative",
      overallConfidence: 0.9,
      options: [{ label: "Maybe", prefill: "Maybe", confidence: 0.5 }],
    };
    expect(shouldDisplaySuggestedResponses(lowOptions)).toBe(false);

    const workflow: SuggestedResponsesPayload = {
      source: "workflow",
      options: [
        { label: "Go", prefill: "Go", role: "primary" },
        { label: "Later", prefill: "Later", role: "defer" },
      ],
    };
    expect(shouldDisplaySuggestedResponses(workflow)).toBe(true);
  });

  it("rejects synonym quote chips after theme review follow-up", () => {
    const synonyms: SuggestedResponseOption[] = [
      {
        label: "extract quotes",
        prefill: "Extract supporting quotes from the transcript",
        confidence: 0.92,
        role: "primary",
      },
      {
        label: "show quotes",
        prefill: "Show quotes from the transcript",
        confidence: 0.9,
        role: "primary",
      },
      {
        label: "proceed with quotes",
        prefill: "Proceed with identifying quotes",
        confidence: 0.88,
        role: "primary",
      },
    ];

    expect(invitesReplyHeuristic(THEME_REVIEW_DONE_FOLLOW_UP)).toBe(true);
    expect(areSuggestedOptionsTooSimilar(synonyms[0]!, synonyms[1]!)).toBe(true);
    expect(rejectSemanticallyRedundantOptions(synonyms)).toHaveLength(1);
    expect(rejectSemanticallyRedundantOptions(synonyms)[0]?.label).toBe("extract quotes");
  });

  it("keeps distinct primary, defer, and alternate for theme saved → quotes", () => {
    const distinct: GenerativeSuggestedResponseOption[] = [
      {
        label: "Identify quotes",
        prefill: "I'm ready — identify supporting quotes from the transcript",
        confidence: 0.91,
        role: "primary",
      },
      {
        label: "Not yet",
        prefill: "Not yet — I'll come back to quotes later",
        confidence: 0.76,
        role: "defer",
      },
      {
        label: "What else?",
        prefill: "What else can we do next?",
        confidence: 0.72,
        role: "alternate",
      },
    ];

    expect(rejectSemanticallyRedundantOptions(distinct)).toHaveLength(3);
    expect(
      normalizeSuggestedResponsesPayload({
        source: "generative",
        overallConfidence: 0.88,
        options: distinct,
      }).options
    ).toHaveLength(3);
  });

  it("keeps distinct options for meeting saved → extract themes", () => {
    const distinct: SuggestedResponseOption[] = [
      {
        label: "Extract themes",
        prefill: "Yes — extract themes from the transcript when you're ready",
        confidence: 0.9,
        role: "primary",
      },
      {
        label: "Not yet",
        prefill: "Not yet — I'll return to themes later",
        confidence: 0.75,
        role: "defer",
      },
      {
        label: "What else?",
        prefill: "What else can we do with this meeting?",
        confidence: 0.7,
        role: "alternate",
      },
    ];

    expect(invitesReplyHeuristic(MEETING_SAVED_FOLLOW_UP)).toBe(true);
    expect(rejectSemanticallyRedundantOptions(distinct)).toHaveLength(3);
  });

  it("hides suggestions when anchor message changes or UI should hide", () => {
    expect(
      areSuggestedResponsesStale({ messageId: "a1" }, "a2")
    ).toBe(true);
    expect(areSuggestedResponsesStale({ messageId: "a1" }, "a1")).toBe(false);
    expect(areSuggestedResponsesStale(null, "a1")).toBe(false);

    expect(
      shouldHideSuggestedResponses({
        view: "home",
        hasSession: true,
        status: "ready",
        isBusy: false,
        inputTrimmed: "",
        hasPendingCard: false,
      })
    ).toBe(true);

    expect(
      shouldHideSuggestedResponses({
        view: "chat",
        hasSession: true,
        status: "streaming",
        isBusy: true,
        inputTrimmed: "",
        hasPendingCard: false,
      })
    ).toBe(true);

    expect(
      shouldHideSuggestedResponses({
        view: "chat",
        hasSession: true,
        status: "ready",
        isBusy: false,
        inputTrimmed: "typing",
        hasPendingCard: false,
      })
    ).toBe(true);

    const bound = {
      messageId: "assistant-1",
      options: [{ label: "Yes", prefill: "Yes", confidence: 0.9 }],
    };
    expect(
      getVisibleSuggestedResponseOptions(bound, "assistant-2", false)
    ).toBeNull();
    expect(
      getVisibleSuggestedResponseOptions(bound, "assistant-1", false)?.[0]?.label
    ).toBe("Yes");
    expect(getVisibleSuggestedResponseOptions(bound, "assistant-1", true)).toBeNull();
  });

  it("anchors suggestions on last non-tool assistant message", () => {
    const messages: UIMessage[] = [
      {
        id: "assistant-text",
        role: "assistant",
        parts: [{ type: "text", text: "Want to proceed?" }],
        metadata: {
          suggestedResponses: {
            source: "generative",
            overallConfidence: 0.9,
            options: [{ label: "Go", prefill: "Go", confidence: 0.9 }],
          },
        },
      },
      {
        id: "assistant-card",
        role: "assistant",
        parts: [{ type: "text", text: "" }],
        metadata: {
          chatTool: { toolName: "meeting_confirmation", input: {}, status: "pending" },
        },
      },
    ];

    expect(getSuggestedResponsesAnchorMessageId(messages)).toBe("assistant-text");
  });

  it("anchors post-card follow-up prose after the tool card in the thread", () => {
    const messages: UIMessage[] = [
      {
        id: "assistant-card",
        role: "assistant",
        parts: [{ type: "text", text: "" }],
        metadata: {
          chatTool: { toolName: "extract_themes", input: {}, status: "success" },
        },
      },
      {
        id: "assistant-follow-up",
        role: "assistant",
        parts: [{ type: "text", text: THEME_REVIEW_DONE_FOLLOW_UP }],
      },
    ];

    expect(getSuggestedResponsesAnchorMessageId(messages)).toBe("assistant-follow-up");
  });

  it("filterDisplayableOptions caps at 3 and sorts by confidence", () => {
    const filtered = filterDisplayableOptions({
      source: "generative",
      overallConfidence: 0.9,
      options: [
        { label: "A", prefill: "a", confidence: 0.66 },
        { label: "B", prefill: "b", confidence: 0.95 },
        { label: "C", prefill: "c", confidence: 0.7 },
        { label: "D", prefill: "d", confidence: 0.8 },
        { label: "E", prefill: "e", confidence: 0.5 },
      ],
    });
    expect(filtered).toHaveLength(3);
    expect(filtered[0]?.label).toBe("B");
    expect(filtered.map((item) => item.label)).not.toContain("E");
  });
});

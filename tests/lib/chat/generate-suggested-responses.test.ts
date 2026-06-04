import { describe, expect, it, vi, beforeEach } from "vitest";

const { generateObjectMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn(),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateObject: generateObjectMock,
  };
});

vi.mock("@ai-sdk/openai", () => ({
  openai: (model: string) => model,
}));

import { generateSuggestedResponses } from "@/lib/chat/generate-suggested-responses";

describe("lib/chat/generate-suggested-responses", () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
  });

  it("returns structured suggestions from generateObject", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        overallConfidence: 0.88,
        options: [
          {
            label: "Yes, extract themes",
            prefill: "Yes, extract themes from the transcript",
            confidence: 0.91,
            role: "primary",
          },
          {
            label: "Not now",
            prefill: "Not now — I'll come back to themes later",
            confidence: 0.75,
            role: "defer",
          },
          {
            label: "What else?",
            prefill: "What else can we do with this meeting?",
            confidence: 0.72,
            role: "alternate",
          },
        ],
      },
    });

    const result = await generateSuggestedResponses({
      assistantText:
        "I've saved the meeting. Want me to extract themes from the transcript now?",
      recentContext: "user: saved the July interview",
    });

    expect(generateObjectMock).toHaveBeenCalledOnce();
    expect(result.source).toBe("generative");
    expect(result.overallConfidence).toBeGreaterThanOrEqual(0.72);
    expect(result.options).toHaveLength(3);
    expect(result.options[0]?.prefill).toContain("extract themes");
    expect(result.options.map((item) => item.role)).toEqual(
      expect.arrayContaining(["primary", "defer", "alternate"])
    );
  });

  it("collapses redundant quote synonyms from the model", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        overallConfidence: 0.9,
        options: [
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
        ],
      },
    });

    const result = await generateSuggestedResponses({
      assistantText:
        "Your theme decisions are saved. Shall we look at identifying and reviewing supporting quotes from the transcript next — say when you are ready, or ask what you would like to do."
    });

    expect(result.options).toHaveLength(1);
    expect(result.options[0]?.label).toBe("extract quotes");
  });
});

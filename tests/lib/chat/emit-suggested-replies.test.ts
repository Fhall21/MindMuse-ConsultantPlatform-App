import { describe, expect, it } from "vitest";
import {
  buildGenerativePayloadFromEmit,
  extractGenerativeSuggestedRepliesFromSteps,
  turnIncludesCardToolFromSteps,
} from "@/lib/chat/tools/emit-suggested-replies";

describe("lib/chat/tools/emit-suggested-replies", () => {
  it("builds generative payload from emit tool output", () => {
    const payload = buildGenerativePayloadFromEmit({
      options: [
        {
          label: "Proceed",
          prefill: "Yes, proceed",
          confidence: 0.9,
          role: "primary",
        },
        {
          label: "Not now",
          prefill: "Not now",
          confidence: 0.7,
          role: "defer",
        },
      ],
    });

    expect(payload.source).toBe("generative");
    expect(payload.options).toHaveLength(2);
  });

  it("extracts emit_suggested_replies from finish steps", () => {
    const payload = extractGenerativeSuggestedRepliesFromSteps([
      {
        toolResults: [
          {
            toolName: "extract_themes",
            output: {},
          },
          {
            toolName: "emit_suggested_replies",
            output: {
              options: [
                {
                  label: "Go",
                  prefill: "Go ahead",
                  confidence: 0.88,
                  role: "primary",
                },
              ],
            },
          },
        ],
      },
    ]);

    expect(payload?.source).toBe("generative");
    expect(payload?.options[0]?.label).toBe("Go");
  });

  it("detects card tools in the same turn", () => {
    expect(
      turnIncludesCardToolFromSteps([
        {
          toolResults: [{ toolName: "ask_user_choice", output: {} }],
        },
      ])
    ).toBe(true);
    expect(
      turnIncludesCardToolFromSteps([
        {
          toolResults: [{ toolName: "emit_suggested_replies", output: {} }],
        },
      ])
    ).toBe(false);
  });
});

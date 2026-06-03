import { describe, expect, it } from "vitest";
import { readToolResultId } from "@/components/chat/cards/types";

describe("readToolResultId", () => {
  it("prefers metadata toolResultId from persisted chat messages", () => {
    expect(
      readToolResultId({
        toolName: "select_meeting_for_action",
        input: {},
        toolResultId: "11111111-1111-4111-8111-111111111111",
        output: { consultation_id: "22222222-2222-4222-8222-222222222222", meetings: [] },
      })
    ).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("falls back to tool_result_id on streamed tool output", () => {
    expect(
      readToolResultId({
        toolName: "select_meeting_for_action",
        input: {},
        output: {
          consultation_id: "22222222-2222-4222-8222-222222222222",
          meetings: [],
          tool_result_id: "33333333-3333-4333-8333-333333333333",
        },
      })
    ).toBe("33333333-3333-4333-8333-333333333333");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildMeetingPickerOutput,
  readMeetingPickerOutput,
} from "@/lib/chat/tools/meetings-picker";
import { formatSelectMeetingForThemesToolReturn } from "@/lib/chat/theme-tool-returns";

describe("lib/chat/tools/meetings-picker", () => {
  it("builds and reads consultation-scoped meeting picker output", () => {
    const output = buildMeetingPickerOutput({
      consultationId: "11111111-1111-4111-8111-111111111111",
      meetings: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          title: "Weekly check-in",
          date: "2026-06-01T12:00:00.000Z",
        },
      ],
    });

    const parsed = readMeetingPickerOutput(output);
    expect(parsed?.consultation_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(parsed?.meetings).toHaveLength(1);
    expect(parsed?.meetings[0]?.title).toBe("Weekly check-in");
  });

  it("returns null for invalid picker payloads", () => {
    expect(readMeetingPickerOutput(null)).toBeNull();
    expect(readMeetingPickerOutput({ consultation_id: "x", meetings: [] })).toBeNull();
  });
});

describe("lib/chat/theme-extract-flow picker returns", () => {
  it("formats pending picker tool results for the agent", () => {
    const pickerResult = {
      ok: true,
      picker: true,
      output: {
        consultation_id: "11111111-1111-4111-8111-111111111111",
        meetings: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            title: "Weekly check-in",
            date: null,
          },
        ],
      },
      toolResultId: "33333333-3333-4333-8333-333333333333",
    };

    expect(formatSelectMeetingForThemesToolReturn(pickerResult)).toEqual({
      consultation_id: "11111111-1111-4111-8111-111111111111",
      meetings: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          title: "Weekly check-in",
          date: null,
        },
      ],
      tool_result_id: "33333333-3333-4333-8333-333333333333",
      picker: true,
    });
  });
});

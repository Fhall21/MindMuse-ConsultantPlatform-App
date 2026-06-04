import { describe, expect, it } from "vitest";
import {
  buildMeetingPickerOutput,
  isMeetingPickerToolResult,
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
          meeting_type_id: "33333333-3333-4333-8333-333333333333",
          meeting_type_label: "1:1 consultation",
          people_names: ["Jake"],
        },
      ],
    });

    const parsed = readMeetingPickerOutput(output);
    expect(parsed?.consultation_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(parsed?.meetings).toHaveLength(1);
    expect(parsed?.meetings[0]?.title).toBe("Weekly check-in");
    expect(parsed?.meetings[0]?.meeting_type_label).toBe("1:1 consultation");
    expect(parsed?.meetings[0]?.people_names).toEqual(["Jake"]);
  });

  it("returns null for invalid picker payloads", () => {
    expect(readMeetingPickerOutput(null)).toBeNull();
    expect(readMeetingPickerOutput({ consultation_id: "x", meetings: [] })).toBeNull();
  });

  it("detects picker tool results vs confirmed meeting output", () => {
    const picker = {
      consultation_id: "c1",
      meetings: [{ id: "m1", title: "1-1", date: null }],
      pending_action: "show_quotes",
      tool_result_id: "tr1",
    };
    expect(isMeetingPickerToolResult(picker)).toBe(true);
    expect(readMeetingPickerOutput(picker)?.meeting_id).toBeUndefined();

    const confirmed = {
      ...picker,
      meeting_id: "m1",
    };
    expect(isMeetingPickerToolResult(confirmed)).toBe(false);

    const quoteReview = {
      meeting_id: "m1",
      meeting_title: "1-1",
      tool_result_id: "tr2",
    };
    expect(isMeetingPickerToolResult(quoteReview)).toBe(false);
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

import { describe, expect, it } from "vitest";
import {
  attachPendingActionToPickerOutput,
  inferMeetingPendingAction,
  readMeetingPendingAction,
} from "@/lib/chat/meeting-pending-action";

describe("meeting pending action", () => {
  it("infers quote and theme intents from user messages", () => {
    expect(inferMeetingPendingAction("extract key quotes from chat with Jake")).toBe(
      "identify_quotes"
    );
    expect(inferMeetingPendingAction("open the quote review panel")).toBe("show_quotes");
    expect(inferMeetingPendingAction("extract themes from the last session")).toBe(
      "extract_themes"
    );
    expect(inferMeetingPendingAction("draft an evidence email for the client")).toBe(
      "draft_evidence_email"
    );
  });

  it("reads pending_action from picker output and defaults for theme picker tool", () => {
    const output = attachPendingActionToPickerOutput(
      {
        consultation_id: "c1",
        meetings: [{ id: "m1", title: "1-1", date: null }],
      },
      "identify_quotes"
    );
    expect(
      readMeetingPendingAction({
        output,
        pickerToolName: "select_meeting_for_action",
      })
    ).toBe("identify_quotes");
    expect(
      readMeetingPendingAction({
        output: { consultation_id: "c1", meetings: [] },
        pickerToolName: "select_meeting_for_themes",
      })
    ).toBe("extract_themes");
  });
});

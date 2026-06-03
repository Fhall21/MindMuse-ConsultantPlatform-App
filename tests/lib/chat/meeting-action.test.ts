import { describe, expect, it } from "vitest";
import {
  buildMeetingActionContinuation,
  isMeetingActionContinuation,
  mergeMeetingActionSelection,
  parseMeetingTitleFromContinuation,
} from "@/lib/chat/tools/meeting-action";

describe("meeting action continuation", () => {
  it("retains picker options while recording the selected meeting", () => {
    expect(
      mergeMeetingActionSelection(
        {
          consultation_id: "consultation-1",
          meetings: [{ id: "meeting-1", title: "Weekly check-in", date: null }],
        },
        "meeting-1"
      )
    ).toEqual({
      consultation_id: "consultation-1",
      meetings: [{ id: "meeting-1", title: "Weekly check-in", date: null }],
      meeting_id: "meeting-1",
    });
  });

  it("builds a natural follow-up and neutralizes nested quotes", () => {
    expect(buildMeetingActionContinuation('Chris "Q2" review')).toBe(
      `Use the selected meeting, "Chris 'Q2' review", for that.`
    );
  });

  it("detects continuation messages and parses the meeting title", () => {
    const text = buildMeetingActionContinuation("1-1 — Jake — Apr 2026");
    expect(isMeetingActionContinuation(text)).toBe(true);
    expect(parseMeetingTitleFromContinuation(text)).toBe("1-1 — Jake — Apr 2026");
  });

});

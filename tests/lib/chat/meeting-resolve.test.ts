import { describe, expect, it } from "vitest";
import {
  extractMeetingHintFromMessage,
  filterMeetingsByTitleHint,
} from "@/lib/chat/meeting-hints";

describe("lib/chat/meeting-resolve", () => {
  it("extracts a person hint from chat-with phrasing", () => {
    expect(extractMeetingHintFromMessage("I want key quotes from chat with Jake")).toBe(
      "Jake"
    );
  });

  it("filters meetings by title hint", () => {
    const meetings = [
      { id: "a", title: "Session with Jake", date: null },
      { id: "b", title: "Session with Chris", date: null },
    ];
    expect(filterMeetingsByTitleHint(meetings, "Jake")).toEqual([meetings[0]]);
  });

  it("skips article words after from/with", () => {
    expect(extractMeetingHintFromMessage("review quotes from the leadership session")).toBe(
      null
    );
    expect(extractMeetingHintFromMessage("review quotes from chat with Jake")).toBe("Jake");
  });
});

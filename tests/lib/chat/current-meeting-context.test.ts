import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("@/db/client", () => ({
  db: {},
}));

import {
  extractMeetingIdFromPayload,
  readCurrentMeetingContext,
  shouldReuseCurrentMeetingForMessage,
  type CurrentMeetingContext,
} from "@/lib/chat/current-meeting-context";

const current: CurrentMeetingContext = {
  meeting_id: "11111111-1111-4111-8111-111111111111",
  consultation_id: "22222222-2222-4222-8222-222222222222",
  title: "1:1 consultation with Jake — April 2026",
  meeting_date: "2026-04-06T00:00:00.000Z",
  meeting_type_id: "33333333-3333-4333-8333-333333333333",
  meeting_type_label: "1:1 consultation",
  people_names: ["Jake"],
};

describe("current meeting context", () => {
  it("reads persisted meeting details", () => {
    expect(
      readCurrentMeetingContext({
        ...current,
        source_tool_name: "show_quotes",
      })
    ).toEqual({
      ...current,
      source_tool_name: "show_quotes",
    });
  });

  it("extracts a meeting id from common tool payloads", () => {
    expect(extractMeetingIdFromPayload({ meeting_id: current.meeting_id })).toBe(
      current.meeting_id
    );
    expect(extractMeetingIdFromPayload({ meeting_ids: [current.meeting_id] })).toBe(
      current.meeting_id
    );
  });

  it("reuses current meeting for this/current phrasing and matching hints", () => {
    expect(shouldReuseCurrentMeetingForMessage(current, "draft an email for this meeting")).toBe(
      true
    );
    expect(shouldReuseCurrentMeetingForMessage(current, "review quotes from chat with Jake")).toBe(
      true
    );
    expect(shouldReuseCurrentMeetingForMessage(current, "review quotes from chat with Chris")).toBe(
      false
    );
  });
});

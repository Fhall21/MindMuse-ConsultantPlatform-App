import { describe, expect, it } from "vitest";
import { readLiteratureReviewProposal } from "@/lib/chat/tools/literature-review";
import {
  formatPendingItemLabel,
  readMeetingNoteProposal,
  readBulkDismissProposal,
  readPersonUnlinkProposal,
} from "@/lib/chat/tools/nl-actions";

describe("literature review proposal", () => {
  it("preserves editable question, context, and persisted session id", () => {
    expect(
      readLiteratureReviewProposal({
        query: "Which factors increase susceptibility to harmful management?",
        industry_ctx: "healthcare",
        research_session_id: "research-1",
      })
    ).toEqual({
      query: "Which factors increase susceptibility to harmful management?",
      industry_ctx: "healthcare",
      research_session_id: "research-1",
    });
  });
});

describe("NL action proposals", () => {
  it("reads editable meeting note proposals", () => {
    expect(
      readMeetingNoteProposal({
        meeting_id: "meeting-1",
        meeting_title: "August session",
        note: "Follow up on workload.",
      })
    ).toEqual({
      meeting_id: "meeting-1",
      meeting_title: "August session",
      note: "Follow up on workload.",
    });
  });

  it("reads person unlink choices for one meeting", () => {
    expect(
      readPersonUnlinkProposal({
        meeting_id: "meeting-1",
        meeting_title: "August session",
        people: [{ id: "person-1", name: "Felix" }],
      })
    ).toMatchObject({
      meeting_id: "meeting-1",
      people: [{ id: "person-1", name: "Felix" }],
    });
  });

  it("reads capped pending-item previews", () => {
    expect(
      readBulkDismissProposal({
        items: [{ id: "result-1", tool_name: "extract_themes" }],
      })
    ).toEqual({
      items: [{ id: "result-1", tool_name: "extract_themes" }],
    });
  });

  it("formats pending item labels without leaking tool names", () => {
    expect(formatPendingItemLabel("extract_themes")).toBe("Theme review");
    expect(formatPendingItemLabel("unknown_tool")).toBe("Pending chat action");
  });
});

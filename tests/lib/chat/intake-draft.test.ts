import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chat/tool-dispatch", () => ({
  dispatchToolToFastApi: vi.fn(),
}));

vi.mock("@/lib/actions/meeting-types", () => ({
  listMeetingTypes: vi.fn().mockResolvedValue([{ id: "type-fc", code: "FC" }]),
}));

import { dispatchToolToFastApi } from "@/lib/chat/tool-dispatch";
import { buildMeetingDraftFromExtractedText } from "@/lib/chat/intake-draft";

const context = {
  userId: "user-1",
  sessionId: "11111111-1111-4111-8111-111111111111",
};

describe("buildMeetingDraftFromExtractedText", () => {
  beforeEach(() => {
    vi.mocked(dispatchToolToFastApi).mockReset();
  });

  it("does not call /transcribe/text — mirrors meetings/new infer path", async () => {
    vi.mocked(dispatchToolToFastApi).mockResolvedValue({
      ok: true,
      data: {
        suggested_type_code: "FC",
        suggested_date: "2026-06-01",
        suggested_people: ["Alex Chen"],
      },
    });

    const result = await buildMeetingDraftFromExtractedText({
      context,
      text: "Alex Chen: We discussed workload.",
      intakeKind: "transcript",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.draft.source_text).toContain("Alex Chen");
    expect(result.draft.participants).toEqual(["Alex Chen"]);
    expect(result.draft.meeting_type_id).toBe("type-fc");

    const endpoints = vi.mocked(dispatchToolToFastApi).mock.calls.map(
      (call) => call[0].endpoint
    );
    expect(endpoints).not.toContain("/transcribe/text");
    expect(endpoints).toContain("/infer/meeting-metadata");
  });

  it("rejects empty extracted text", async () => {
    const result = await buildMeetingDraftFromExtractedText({
      context,
      text: "   ",
      intakeKind: "transcript",
    });

    expect(result).toEqual({ ok: false, error: "Transcript text is empty." });
    expect(dispatchToolToFastApi).not.toHaveBeenCalled();
  });

  it("returns base draft when infer fails", async () => {
    vi.mocked(dispatchToolToFastApi).mockResolvedValue({
      ok: false,
      error: "Unauthorized",
    });

    const result = await buildMeetingDraftFromExtractedText({
      context,
      text: "Speaker: hello",
      intakeKind: "transcript",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.draft.title).toBe("Untitled meeting");
    expect(result.draft.source_text).toBe("Speaker: hello");
  });
});

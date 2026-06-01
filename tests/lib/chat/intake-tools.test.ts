import { describe, expect, it } from "vitest";
import {
  mapClarificationQuestions,
  normalizeMeetingDraft,
  previewText,
} from "@/lib/chat/tools/intake";
import { readMeetingDraft } from "@/components/chat/cards/types";

describe("lib/chat/tools/intake", () => {
  it("normalizes FastAPI meeting draft payloads", () => {
    const draft = normalizeMeetingDraft(
      {
        title: "Leadership check-in",
        date: "2026-05-12T12:00:00.000Z",
        participants: ["Alex Chen"],
        notes_preview: "Discussed workload",
      },
      "Discussed workload and team morale."
    );

    expect(draft.title).toBe("Leadership check-in");
    expect(draft.participants).toEqual(["Alex Chen"]);
    expect(draft.source_text).toBe("Discussed workload and team morale.");
  });

  it("normalizes meeting type and person ids", () => {
    const draft = normalizeMeetingDraft({
      title: "FC — Alex — Jun 2026",
      date: "2026-06-01T12:00:00.000Z",
      participants: ["Alex Chen"],
      meeting_type_id: "11111111-1111-4111-8111-111111111111",
      suggested_type_code: "FC",
      person_ids: ["22222222-2222-4222-8222-222222222222"],
    });

    expect(draft.meeting_type_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(draft.suggested_type_code).toBe("FC");
    expect(draft.person_ids).toEqual(["22222222-2222-4222-8222-222222222222"]);
  });

  it("maps clarification questions from FastAPI shape", () => {
    const questions = mapClarificationQuestions({
      questions: [
        {
          question: "Was EAP referral agreed?",
          type: "confirm",
          theme_label: "Support",
        },
      ],
    });

    expect(questions).toHaveLength(1);
    expect(questions[0]?.field).toBe("confirm");
    expect(questions[0]?.question).toContain("EAP");
  });

  it("truncates long preview text", () => {
    const preview = previewText("a".repeat(400), 120);
    expect(preview.endsWith("…")).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(121);
  });
});

describe("readMeetingDraft", () => {
  it("unwraps meeting_draft from POST /api/meetings success output", () => {
    const draft = readMeetingDraft({
      meeting_draft: {
        title: "Leadership sync",
        date: "2026-06-01T12:00:00.000Z",
        participants: ["Alex Chen"],
        project_id: "11111111-1111-4111-8111-111111111111",
      },
      meeting_record: { id: "22222222-2222-4222-8222-222222222222" },
    });

    expect(draft?.title).toBe("Leadership sync");
    expect(draft?.participants).toEqual(["Alex Chen"]);
  });
});

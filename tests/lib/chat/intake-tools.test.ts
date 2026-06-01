import { describe, expect, it } from "vitest";
import {
  mapClarificationQuestions,
  normalizeMeetingDraft,
  previewText,
} from "@/lib/chat/tools/intake";

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

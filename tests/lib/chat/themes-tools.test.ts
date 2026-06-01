import { describe, expect, it } from "vitest";
import {
  buildThemeReviewOutput,
  getConfidenceLabel,
  normalizeExtractedThemes,
  readThemeReviewOutput,
} from "@/lib/chat/tools/themes";

describe("lib/chat/tools/themes", () => {
  it("normalizes FastAPI theme extraction payloads", () => {
    const themes = normalizeExtractedThemes({
      themes: [
        {
          label: "Workload pressure blocking recovery time",
          description: "Discussed sustained overtime without recovery.",
          confidence: 0.82,
        },
        { label: "", description: "skip me" },
      ],
    });

    expect(themes).toHaveLength(1);
    expect(themes[0]?.label).toContain("Workload");
    expect(themes[0]?.confidence).toBe(0.82);
  });

  it("builds and reads theme review output with decisions", () => {
    const output = buildThemeReviewOutput({
      meetingId: "11111111-1111-4111-8111-111111111111",
      themes: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          label: "Theme A",
          description: "Desc",
          source_quotes: [],
          confidence: 0.7,
        },
      ],
      decisions: {
        "22222222-2222-4222-8222-222222222222": "accepted",
      },
    });

    const parsed = readThemeReviewOutput(output);
    expect(parsed?.meeting_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(parsed?.decisions["22222222-2222-4222-8222-222222222222"]).toBe(
      "accepted"
    );
  });

  it("maps confidence to display labels", () => {
    expect(getConfidenceLabel(0.85).label).toBe("High confidence");
    expect(getConfidenceLabel(0.5).label).toBe("Medium confidence");
    expect(getConfidenceLabel(0.2).label).toBe("Low confidence");
  });
});

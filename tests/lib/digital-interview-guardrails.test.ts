import { describe, expect, it } from "vitest";
import {
  getActiveDigitalInterviewGuardrails,
  normalizeGuardrailConfig,
  recommendDigitalInterviewGuardrails,
  UNIVERSAL_DIGITAL_INTERVIEW_GUARDRAILS,
} from "@/lib/digital-interview-guardrails";

describe("recommendDigitalInterviewGuardrails", () => {
  it("recommends deterministic boundaries from topics and framework", () => {
    const recommendations = recommendDigitalInterviewGuardrails({
      title: "Psychological safety interview",
      framework: "psychological_safety",
      customFrameworkPrompt: null,
      topics: ["Speaking up", "Burnout and stress"],
    });

    expect(recommendations.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "recommended-avoid-medical-detail",
        "recommended-speak-up-safety",
      ])
    );
  });

  it("keeps only accepted recommendations active", () => {
    const active = getActiveDigitalInterviewGuardrails({
      title: "Policy review",
      framework: "appreciative_inquiry",
      customFrameworkPrompt: null,
      topics: ["Policy clarity"],
      guardrailsConfig: {
        acceptedRecommendedIds: ["recommended-no-policy-interpretation"],
        dismissedRecommendedIds: [],
        customGuardrails: ["Do not ask for names."],
      },
    });

    expect(active.universal).toHaveLength(UNIVERSAL_DIGITAL_INTERVIEW_GUARDRAILS.length);
    expect(active.recommended.map((item) => item.id)).toEqual([
      "recommended-no-policy-interpretation",
    ]);
    expect(active.custom[0]?.description).toBe("Do not ask for names.");
  });
});

describe("normalizeGuardrailConfig", () => {
  it("defaults missing config to empty editable lists", () => {
    expect(normalizeGuardrailConfig(null)).toEqual({
      acceptedRecommendedIds: [],
      dismissedRecommendedIds: [],
      customGuardrails: [],
    });
  });
});

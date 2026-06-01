import { describe, expect, it } from "vitest";
import { selectSubPrompts } from "@/lib/chat/onboarding-prompts";
import type { OnboardingAccountState } from "@/lib/chat/onboarding-state";

function buildState(
  overrides: Partial<OnboardingAccountState> = {}
): OnboardingAccountState {
  return {
    hasConsultation: false,
    hasMeeting: false,
    hasInsight: false,
    hasConsultationTheme: false,
    hasQuotes: false,
    hasGrouping: false,
    hasCanvasConnection: false,
    hasReport: false,
    activeConsultations: 0,
    phase: "needs_consultation",
    userMode: "onboarding",
    ...overrides,
  };
}

describe("lib/chat/onboarding-prompts", () => {
  it("includes create consultation guidance for brand-new users", () => {
    const prompts = selectSubPrompts(buildState());
    expect(prompts.some((block) => block.includes("consultation is the engagement"))).toBe(true);
  });

  it("omits create consultation guidance when consultation exists", () => {
    const prompts = selectSubPrompts(
      buildState({
        hasConsultation: true,
        hasMeeting: false,
        phase: "needs_meeting",
      })
    );
    expect(prompts.some((block) => block.includes("consultation is the engagement"))).toBe(false);
    expect(prompts.some((block) => block.includes("first meeting"))).toBe(true);
  });

  it("keeps grouping guidance for multi-consultation users", () => {
    const prompts = selectSubPrompts(
      buildState({
        hasConsultation: true,
        hasMeeting: true,
        hasInsight: true,
        hasQuotes: false,
        activeConsultations: 2,
        phase: "needs_quotes",
      })
    );
    expect(prompts.some((block) => block.includes("multiple consultations"))).toBe(true);
  });
});

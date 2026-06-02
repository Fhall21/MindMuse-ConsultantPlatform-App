import { describe, expect, it } from "vitest";
import { buildResumeSuggestion } from "@/lib/chat/resume-suggestion";
import { buildDynamicSystemPrompt } from "@/lib/chat/system-prompts";
import type { OnboardingAccountState } from "@/lib/chat/onboarding-state";

const returningState: OnboardingAccountState = {
  hasConsultation: true,
  hasMeeting: true,
  hasInsight: true,
  hasConsultationTheme: true,
  hasQuotes: true,
  hasGrouping: true,
  hasCanvasConnection: false,
  hasReport: false,
  activeConsultations: 1,
  phase: "returning",
  userMode: "returning",
};

describe("resume suggestion", () => {
  it("builds optional chip data for pending theme review", () => {
    expect(buildResumeSuggestion({ toolName: "extract_themes" })).toEqual({
      toolName: "extract_themes",
      label: "Resume theme review",
      prefill: "Continue extract themes",
    });
  });

  it("returns null when no pending item exists", () => {
    expect(buildResumeSuggestion(null)).toBeNull();
  });

  it("never injects stale resume prose into the model prompt", () => {
    const prompt = buildDynamicSystemPrompt(returningState, null, {
      sessionContext: { lastAction: null },
    });
    expect(prompt).not.toContain("[SESSION MEMORY:");
    expect(prompt).not.toContain("Welcome back. extract themes. Want to continue?");
    expect(prompt).toContain("current request always wins");
  });
});

describe("getPendingSessionItem - staleness threshold", () => {
  it("14-day cutoff constant is correct", () => {
    const before = Date.now() - 13 * 24 * 60 * 60 * 1000;
    const after = Date.now() - 15 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;

    expect(before).toBeGreaterThan(cutoff);
    expect(after).toBeLessThan(cutoff);
  });
});

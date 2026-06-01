import { describe, expect, it } from "vitest";
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

describe("lib/chat/system-prompts", () => {
  it("composes onboarding prompts with account injection", () => {
    const prompt = buildDynamicSystemPrompt(
      {
        ...returningState,
        userMode: "onboarding",
        phase: "needs_meeting",
        hasMeeting: false,
        hasQuotes: false,
        hasGrouping: false,
      },
      null
    );

    expect(prompt).toContain("[ONBOARDING STATE:");
    expect(prompt).toContain("needs_meeting");
    expect(prompt).toContain("first meeting");
  });

  it("uses minimal returning base without sub-prompt blocks", () => {
    const prompt = buildDynamicSystemPrompt(returningState, null);
    expect(prompt).toContain("Be direct and action-first");
    expect(prompt).toContain("MeetingConfirmationCard");
    expect(prompt).not.toContain("Create consultation");
  });

  it("includes tool card rules for onboarding mode", () => {
    const prompt = buildDynamicSystemPrompt(
      {
        ...returningState,
        userMode: "onboarding",
        phase: "needs_meeting",
        hasMeeting: false,
      },
      null
    );

    expect(prompt).toContain("intake_text_transcript");
    expect(prompt).toContain("extract_themes");
    expect(prompt).toContain("ThemeReviewCard");
    expect(prompt).toContain("NEVER write meeting fields");
    expect(prompt).toContain("NEVER call confirm_meeting");
  });
});

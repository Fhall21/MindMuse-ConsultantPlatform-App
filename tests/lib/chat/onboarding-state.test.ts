import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/data/domain-read", () => ({
  getDashboardStats: vi.fn(),
}));

vi.mock("@/lib/chat/context", () => ({
  countActiveConsultations: vi.fn(),
}));

import {
  derivePhase,
  deriveUserMode,
  isFirstHalfOnboardingComplete,
} from "@/lib/chat/onboarding-state";

describe("lib/chat/onboarding-state", () => {
  it("derives user mode from first-half milestones", () => {
    expect(
      deriveUserMode({
        hasConsultation: true,
        hasMeeting: true,
        hasInsight: true,
        hasQuotes: false,
      })
    ).toBe("onboarding");

    expect(
      deriveUserMode({
        hasConsultation: true,
        hasMeeting: true,
        hasInsight: true,
        hasQuotes: true,
      })
    ).toBe("returning");
  });

  it("skips needs_consultation for sidebar users with existing consultations", () => {
    const phase = derivePhase({
      hasConsultation: true,
      hasMeeting: false,
      hasInsight: false,
      hasQuotes: false,
      hasGrouping: false,
      activeConsultations: 1,
      userMode: "onboarding",
    });

    expect(phase).toBe("needs_meeting");
  });

  it("requires grouping guidance for multi-consultation users", () => {
    const phase = derivePhase({
      hasConsultation: true,
      hasMeeting: true,
      hasInsight: true,
      hasQuotes: true,
      hasGrouping: false,
      activeConsultations: 2,
      userMode: "onboarding",
    });

    expect(phase).toBe("needs_grouping");
  });

  it("detects first-half completion", () => {
    expect(
      isFirstHalfOnboardingComplete({
        hasConsultation: true,
        hasMeeting: true,
        hasInsight: true,
        hasQuotes: true,
      })
    ).toBe(true);
  });
});

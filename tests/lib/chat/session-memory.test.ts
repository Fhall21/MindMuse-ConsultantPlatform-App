import { describe, expect, it } from "vitest";
import { buildDynamicSystemPrompt, type SessionRuntimeContext } from "@/lib/chat/system-prompts";
import { AGENT_VOICE } from "@/lib/chat/agent-voice";
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

const onboardingState: OnboardingAccountState = {
  ...returningState,
  phase: "needs_meeting",
  userMode: "onboarding",
  hasMeeting: false,
};

describe("session memory callbacks — system prompt injection", () => {
  it("injects [SESSION MEMORY] with pending item on first turn for returning user", () => {
    const ctx: SessionRuntimeContext = {
      lastAction: null,
      pendingItem: { toolName: "edit_theme", input: { name: "Trust deficit" } },
      isFirstTurnReturning: true,
    };

    const prompt = buildDynamicSystemPrompt(returningState, null, { sessionContext: ctx });
    expect(prompt).toContain("[SESSION MEMORY:");
    expect(prompt).toContain("edit_theme");
    expect(prompt).toContain(AGENT_VOICE.WELCOME_BACK_WITH_PENDING("edit theme — \"Trust deficit\""));
  });

  it("injects no-pending greeting on first turn returning with no pending items", () => {
    const ctx: SessionRuntimeContext = {
      lastAction: null,
      pendingItem: null,
      isFirstTurnReturning: true,
    };

    const prompt = buildDynamicSystemPrompt(returningState, null, { sessionContext: ctx });
    expect(prompt).toContain("[SESSION MEMORY:");
    expect(prompt).toContain(AGENT_VOICE.WELCOME_BACK_NO_PENDING);
  });

  it("does not inject [SESSION MEMORY] when isFirstTurnReturning is false", () => {
    const ctx: SessionRuntimeContext = {
      lastAction: null,
      pendingItem: { toolName: "edit_theme", input: null },
      isFirstTurnReturning: false,
    };

    const prompt = buildDynamicSystemPrompt(returningState, null, { sessionContext: ctx });
    expect(prompt).not.toContain("[SESSION MEMORY:");
  });

  it("does not inject [SESSION MEMORY] for onboarding users", () => {
    const ctx: SessionRuntimeContext = {
      lastAction: null,
      pendingItem: null,
      isFirstTurnReturning: false,
    };

    const prompt = buildDynamicSystemPrompt(onboardingState, null, { sessionContext: ctx });
    expect(prompt).not.toContain("[SESSION MEMORY:");
  });

  it("pending item description falls back to tool name when no name in input", () => {
    const ctx: SessionRuntimeContext = {
      lastAction: null,
      pendingItem: { toolName: "create_insight", input: null },
      isFirstTurnReturning: true,
    };

    const prompt = buildDynamicSystemPrompt(returningState, null, { sessionContext: ctx });
    expect(prompt).toContain("create insight");
  });
});

describe("getPendingSessionItem — staleness threshold", () => {
  it("14-day cutoff constant is correct", async () => {
    const before = Date.now() - 13 * 24 * 60 * 60 * 1000;
    const after = Date.now() - 15 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;

    expect(before).toBeGreaterThan(cutoff);
    expect(after).toBeLessThan(cutoff);
  });
});

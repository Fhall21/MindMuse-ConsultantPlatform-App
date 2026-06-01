import { describe, expect, it, vi } from "vitest";
import { buildDynamicSystemPrompt, type SessionRuntimeContext } from "@/lib/chat/system-prompts";
import { AGENT_VOICE } from "@/lib/chat/agent-voice";
import type { OnboardingAccountState } from "@/lib/chat/onboarding-state";

vi.mock("@/db/client", () => ({ db: {} }));

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

const noSessionContext: SessionRuntimeContext = {
  lastAction: null,
  pendingItem: null,
  isFirstTurnReturning: false,
};

describe("undo / revision — system prompt injection", () => {
  it("always includes UNDO_RULES block", () => {
    const prompt = buildDynamicSystemPrompt(returningState, null, {
      sessionContext: noSessionContext,
    });
    expect(prompt).toContain(AGENT_VOICE.UNDO_NOTHING_IN_SESSION);
    expect(prompt).toContain(AGENT_VOICE.UNDO_BULK_NOT_REVERSIBLE);
  });

  it("injects [UNDO CONTEXT] block when lastAction is provided", () => {
    const ctx: SessionRuntimeContext = {
      lastAction: {
        toolName: "edit_meeting",
        createdAt: new Date("2026-06-01T10:00:00.000Z"),
        input: null,
      },
      pendingItem: null,
      isFirstTurnReturning: false,
    };

    const prompt = buildDynamicSystemPrompt(returningState, null, { sessionContext: ctx });
    expect(prompt).toContain("[UNDO CONTEXT:");
    expect(prompt).toContain("edit_meeting");
    expect(prompt).toContain("2026-06-01T10:00:00.000Z");
  });

  it("does not inject [UNDO CONTEXT] block when lastAction is null", () => {
    const prompt = buildDynamicSystemPrompt(returningState, null, {
      sessionContext: noSessionContext,
    });
    expect(prompt).not.toContain("[UNDO CONTEXT:");
  });

  it("includes undo detection intent examples", () => {
    const prompt = buildDynamicSystemPrompt(returningState, null, {
      sessionContext: noSessionContext,
    });
    expect(prompt).toContain("undo that");
    expect(prompt).toContain("go back");
    expect(prompt).toContain("change what I just confirmed");
  });

  it("prompt is unchanged when no sessionContext option passed", () => {
    const withCtx = buildDynamicSystemPrompt(returningState, null, {
      sessionContext: noSessionContext,
    });
    expect(withCtx).toContain(AGENT_VOICE.UNDO_NOTHING_IN_SESSION);
  });
});

describe("undo / revision — REVERSIBLE_TOOLS list", () => {
  it("exports the expected reversible tool names", async () => {
    const { REVERSIBLE_TOOLS } = await import("@/lib/chat/persist");
    expect(REVERSIBLE_TOOLS).toContain("edit_meeting");
    expect(REVERSIBLE_TOOLS).toContain("edit_theme");
    expect(REVERSIBLE_TOOLS).toContain("create_insight");
    expect(REVERSIBLE_TOOLS).toContain("link_person_to_consultation");
    expect(REVERSIBLE_TOOLS).toContain("confirm_meeting");
    expect(REVERSIBLE_TOOLS).toContain("confirm_themes");
    expect(REVERSIBLE_TOOLS).not.toContain("generate_report");
    expect(REVERSIBLE_TOOLS).not.toContain("draft_evidence_email");
  });
});

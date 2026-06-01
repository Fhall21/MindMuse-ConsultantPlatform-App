import { describe, expect, it } from "vitest";
import { buildDynamicSystemPrompt } from "@/lib/chat/system-prompts";
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

describe("lib/chat/auto-intake — system prompt behaviour", () => {
  it(">200-word paste: auto-intake instruction present in prompt when not suppressed", () => {
    const prompt = buildDynamicSystemPrompt(returningState, null, {
      autoIntakeSuppressed: false,
    });
    expect(prompt).toContain(AGENT_VOICE.AUTO_INTAKE_PROMPT);
    expect(prompt).toContain(">200 words");
  });

  it("short text: auto-intake instruction still present (model decides on message length)", () => {
    // The system prompt always includes the detection rule when not suppressed.
    // The model applies the >200 word heuristic per message — not our code.
    const prompt = buildDynamicSystemPrompt(returningState, null, {
      autoIntakeSuppressed: false,
    });
    expect(prompt).toContain(AGENT_VOICE.AUTO_INTAKE_PROMPT);
  });

  it("suppression active: auto-intake instruction replaced with suppressed note", () => {
    const prompt = buildDynamicSystemPrompt(returningState, null, {
      autoIntakeSuppressed: true,
    });
    expect(prompt).not.toContain(AGENT_VOICE.AUTO_INTAKE_PROMPT);
    expect(prompt).toContain("AUTO-INTAKE SUPPRESSED");
  });
});

import { describe, expect, it } from "vitest";
import { buildDynamicSystemPrompt } from "@/lib/chat/system-prompts";
import type { OnboardingAccountState } from "@/lib/chat/onboarding-state";
import { AGENT_VOICE } from "@/lib/chat/agent-voice";

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
    expect(prompt).toContain("MeetingPickerCard");
    expect(prompt).toContain("NEVER ask the user to re-paste");
    expect(prompt).toContain("ThemeReviewCard");
    expect(prompt).toContain("NEVER write meeting fields");
    expect(prompt).toContain("NEVER call confirm_meeting");
  });
});

describe("lib/chat/system-prompts — NL intents (paraphrase coverage)", () => {
  const prompt = buildDynamicSystemPrompt(returningState, null);

  it("intent 1 — THEME RECALL: 3+ phrasings present", () => {
    expect(prompt).toContain("What themes came out of the July meeting?");
    expect(prompt).toContain("last week's interview");
    expect(prompt).toContain("emerged from the Smith engagement");
    expect(prompt).toContain("Summarise the themes from Tuesday's session");
  });

  it("intent 2 — STATUS QUERY: 3+ phrasings present", () => {
    expect(prompt).toContain("How many meetings are in this consultation?");
    expect(prompt).toContain("Where are we in the engagement?");
    expect(prompt).toContain("Give me a status update");
    expect(prompt).toContain("How much have we processed so far?");
  });

  it("intent 3 — PERSON UNLINK: 3+ phrasings present", () => {
    expect(prompt).toContain("Remove Felix from this consultation");
    expect(prompt).toContain("Unlink Sarah from this engagement");
    expect(prompt).toContain("Take Marcus off this project");
    expect(prompt).toContain("Felix shouldn't be listed here");
  });

  it("intent 4 — THEME RENAME: 3+ phrasings present", () => {
    expect(prompt).toContain("Rename the trust theme to institutional distrust");
    expect(prompt).toContain("authority structures");
    expect(prompt).toContain("executive accountability");
    expect(prompt).toContain("Relabel the first theme");
  });

  it("intent 5 — AUDIT SUMMARY: 3+ phrasings present", () => {
    expect(prompt).toContain("What changed this week?");
    expect(prompt).toContain("Give me a change log");
    expect(prompt).toContain("What happened in the last 7 days?");
    expect(prompt).toContain("Show me recent activity on this engagement");
  });

  it("intent 6 — EVIDENCE RECALL: 3+ phrasings present", () => {
    expect(prompt).toContain("What did we decide about leadership?");
    expect(prompt).toContain("Find quotes about trust");
    expect(prompt).toContain("What did participants say about power?");
    expect(prompt).toContain("Pull evidence on budget concerns from the interviews");
  });

  it("intent 7 — REPORT STATUS: 3+ phrasings present", () => {
    expect(prompt).toContain("Is the report ready?");
    expect(prompt).toContain("Has the report been generated?");
    expect(prompt).toContain("Can I download the report?");
    expect(prompt).toContain("draft email done for this consultation");
  });

  it("intent 8 — NOTE ATTACH: 3+ phrasings present", () => {
    expect(prompt).toContain("Add a note to the August meeting: we need to follow up on budget");
    expect(prompt).toContain("participant was distressed");
    expect(prompt).toContain("Attach a comment to the last meeting");
    expect(prompt).toContain("Flag the July session");
  });

  it("intent 9 — PEOPLE ROSTER: 3+ phrasings present", () => {
    expect(prompt).toContain("Who's in this consultation?");
    expect(prompt).toContain("List the participants");
    expect(prompt).toContain("Who have we linked to this engagement?");
    expect(prompt).toContain("Show me the people roster for this project");
  });

  it("intent 10 — BULK DISMISS: 3+ phrasings present", () => {
    expect(prompt).toContain("Dismiss all pending suggestions");
    expect(prompt).toContain("Clear all suggestions");
    expect(prompt).toContain("Remove all pending items");
    expect(prompt).toContain("Dismiss everything waiting for review in this session");
  });
});

describe("lib/chat/system-prompts — proactive triggers", () => {
  it("injects grouping suggestion when 2+ meetings, no groups", () => {
    const prompt = buildDynamicSystemPrompt(returningState, null, {
      proactiveTriggers: { meetingsReadyToGroup: { count: 3 } },
    });
    expect(prompt).toContain(AGENT_VOICE.PROACTIVE_GROUP_THEMES(3));
  });

  it("injects quotes suggestion when themes exist but no quotes", () => {
    const prompt = buildDynamicSystemPrompt(returningState, null, {
      proactiveTriggers: { themesNeedQuotes: { count: 5 } },
    });
    expect(prompt).toContain(AGENT_VOICE.PROACTIVE_IDENTIFY_QUOTES(5));
  });

  it("injects report ready suggestion", () => {
    const prompt = buildDynamicSystemPrompt(returningState, null, {
      proactiveTriggers: { reportReady: { meetingName: "July interview" } },
    });
    expect(prompt).toContain(AGENT_VOICE.PROACTIVE_REPORT_READY("July interview"));
  });

  it("caps at 2 proactive suggestions per request", () => {
    const prompt = buildDynamicSystemPrompt(returningState, null, {
      proactiveTriggers: {
        meetingsReadyToGroup: { count: 2 },
        themesNeedQuotes: { count: 4 },
        reportReady: { meetingName: "August meeting" },
      },
    });
    const matches = prompt.match(/PROACTIVE SUGGESTIONS/g);
    expect(matches?.length).toBe(1);
    // Only first 2 triggers should appear in the hint block
    expect(prompt).toContain(AGENT_VOICE.PROACTIVE_GROUP_THEMES(2));
    expect(prompt).toContain(AGENT_VOICE.PROACTIVE_IDENTIFY_QUOTES(4));
    expect(prompt).not.toContain(AGENT_VOICE.PROACTIVE_REPORT_READY("August meeting"));
  });

  it("no proactive block when no triggers", () => {
    const prompt = buildDynamicSystemPrompt(returningState, null, {
      proactiveTriggers: {},
    });
    expect(prompt).not.toContain("PROACTIVE SUGGESTIONS");
  });
});

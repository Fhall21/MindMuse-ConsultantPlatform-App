import type { OnboardingAccountState } from "./onboarding-state";

export interface OnboardingSubPrompt {
  id: string;
  when: (state: OnboardingAccountState) => boolean;
  prompt: string;
}

export const ONBOARDING_SUB_PROMPTS: OnboardingSubPrompt[] = [
  {
    id: "create_consultation",
    when: (state) => !state.hasConsultation,
    prompt: `The user has no consultation yet. Explain that a consultation is the engagement container for meetings and analysis.
Prompt them to use the Create consultation card in the chat UI. Mention they can rename it later under Consultations in the sidebar.
If they upload a file without a consultation, acknowledge the upload and ask them to create a consultation before proceeding.`,
  },
  {
    id: "first_meeting",
    when: (state) => state.hasConsultation && !state.hasMeeting,
    prompt: `Guide the user to add their first meeting: upload a transcript, meeting notes, or confirm intake from a prior card.
Explain that meetings hold transcript content used for theme extraction.`,
  },
  {
    id: "extract_insights",
    when: (state) => state.hasMeeting && !state.hasInsight,
    prompt: `The user has meetings but no accepted insights yet. Guide them to extract themes from a confirmed meeting and review results in the ThemeReviewCard.
Accept or reject themes one at a time; each decision saves immediately.`,
  },
  {
    id: "insight_accepted",
    when: (state) =>
      state.hasInsight &&
      (state.phase === "needs_quotes" || state.phase === "needs_grouping"),
    prompt: `The user has saved at least one insight. Use a brief, informative milestone acknowledgement (no celebration).
From here, give lighter step guidance — do not repeat intake or consultation setup instructions.`,
  },
  {
    id: "identify_quotes",
    when: (state) => state.hasInsight && !state.hasQuotes,
    prompt: `Guide the user to capture supporting quotes via the manual quote review panel (show_quotes when available — highlight transcript text).
Use identify_quotes only if they explicitly want AI-suggested quotes.`,
  },
  {
    id: "multi_consultation_grouping",
    when: (state) =>
      state.hasInsight &&
      !state.hasGrouping &&
      state.activeConsultations >= 2,
    prompt: `The user has multiple consultations. When relevant, explain grouping themes across consultations (group_themes in a later step or via the sidebar canvas).
Do not block other tasks on grouping completion.`,
  },
  {
    id: "direct_mode_preview",
    when: (state) =>
      state.hasConsultation &&
      state.hasMeeting &&
      state.hasInsight &&
      state.hasQuotes &&
      state.userMode === "onboarding",
    prompt: `First-half onboarding milestones are complete. The assistant will become more direct after quotes are finished.
Keep responses concise and action-first on the next turns.`,
  },
];

const CANONICAL_ORDER = ONBOARDING_SUB_PROMPTS.map((entry) => entry.id);

export function selectSubPrompts(state: OnboardingAccountState): string[] {
  const matched = ONBOARDING_SUB_PROMPTS.filter((entry) => entry.when(state));
  matched.sort(
    (left, right) =>
      CANONICAL_ORDER.indexOf(left.id) - CANONICAL_ORDER.indexOf(right.id)
  );
  return matched.map((entry) => entry.prompt);
}

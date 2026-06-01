import type {
  OnboardingAccountState,
  OnboardingPhase,
  WelcomeVariant,
} from "./onboarding-state";

export type { WelcomeVariant };

export function deriveWelcomeVariant(
  state: Pick<
    OnboardingAccountState,
    "userMode" | "hasConsultation" | "hasMeeting" | "hasInsight"
  >
): WelcomeVariant {
  if (state.userMode === "returning") {
    return "returning";
  }

  if (!state.hasConsultation && !state.hasMeeting && !state.hasInsight) {
    return "brand_new";
  }

  return "resume_onboarding";
}

export function getWelcomeGreeting(
  variant: WelcomeVariant,
  displayName: string
): string {
  switch (variant) {
    case "brand_new":
      return "Welcome to MindMuse. Let's start your first consultation.";
    case "resume_onboarding":
      return `Welcome back, ${displayName}. Pick up where you left off.`;
    case "returning":
      return `Welcome back, ${displayName}. What would you like to do today?`;
  }
}

export const CREATE_CONSULTATION_COPY = {
  title: "Create your first consultation",
  description:
    "A consultation is the engagement container for meetings and analysis. Rename it anytime under Consultations in the sidebar.",
  label: "Consultation name",
  placeholder: "e.g. Leadership round — Q2",
  submit: "Create consultation",
  pending: "Creating…",
  success: "Consultation created.",
  error: "Could not create consultation. Try again.",
} as const;

export const FILE_ATTACH_STARTED_COPY =
  "File attached. Create a consultation first if you have not already — the assistant will guide you.";

export const CARD_REOPEN_HELP =
  "Ask in chat if you want to change any details and I'll bring the form back.";

export const CARD_DISMISSED_COPY =
  "Ask in chat to reopen this step if you change your mind.";

export const MEETING_CONFIRM_SUCCESS_COPY =
  "Meeting saved. You can extract insights from it next.";

/** Inserted as assistant message after UI meeting confirm (chat session). */
export const MEETING_SAVED_FOLLOW_UP =
  "Your meeting is saved. I can extract themes from the transcript next — say when you are ready, or ask what you would like to do.";

/** Inserted after ThemeReviewCard completes (Done reviewing). */
export const THEME_REVIEW_DONE_FOLLOW_UP =
  "Your theme decisions are saved. I can identify supporting quotes from the transcript next — say when you are ready, or ask what you would like to do.";

/** Inserted after QuoteCard completes (Done reviewing). */
export const QUOTE_REVIEW_DONE_FOLLOW_UP =
  "Quote review is done. You can review everything under Meetings in the sidebar, or tell me what you would like to do next.";

export function meetingSavedDescription(title: string) {
  const trimmed = title.trim();
  return trimmed
    ? `${trimmed} is saved to your consultation.`
    : "Your meeting is saved to your consultation.";
}

export const INSIGHT_ACCEPT_COPY = "Insight saved.";

export const INSIGHT_REVIEW_DONE_COPY = (count: number) =>
  count === 1
    ? "First insight saved — review it under Meetings when you are ready."
    : `${count} insights saved — review them under Meetings when you are ready.`;

export const QUOTE_REVIEW_COMPLETE_COPY = (count: number) =>
  count === 1
    ? "1 quote linked to your insights."
    : `${count} quotes linked to your insights.`;

export function shouldShowCreateConsultationCard(
  phase: OnboardingPhase,
  consultationId: string | null
): boolean {
  return phase === "needs_consultation" && !consultationId;
}

export function getWelcomeQuickActionPriority(phase: OnboardingPhase): {
  showUploadTranscript: boolean;
  showUploadNotes: boolean;
  showPendingInsights: boolean;
} {
  return {
    showUploadTranscript: phase !== "needs_consultation",
    showUploadNotes: phase !== "needs_consultation",
    showPendingInsights: phase !== "needs_consultation" && phase !== "needs_meeting",
  };
}

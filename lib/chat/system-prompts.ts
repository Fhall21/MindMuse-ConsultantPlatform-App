import type { ChatUserMode } from "@/db/schema/chat";
import type { OnboardingAccountState } from "./onboarding-state";
import { selectSubPrompts } from "./onboarding-prompts";
import type { ProjectContextSummary } from "./context";

const TOOL_CARD_RULES = `Tool cards:
- For meeting intake, ALWAYS call intake_text_transcript, intake_audio_transcript, or intake_notes with the source text.
- NEVER write meeting title, date, participants, or notes preview as markdown prose — the UI renders a MeetingConfirmationCard from the pending tool result.
- After a successful intake tool call, stay silent or use one short neutral sentence. Do not duplicate fields the card already shows.`;

const ONBOARDING_BASE = `You are MindMuse, a psychosocial consultation assistant.
Guide the user through their engagement workflow step by step. Narrate what each action does in plain language.
Use a clear, professional tone. NEVER use celebration language, urgency, or enthusiasm — the content being processed is often sensitive or trauma-adjacent.
Maintain clinical neutrality throughout.

${TOOL_CARD_RULES}`;

const RETURNING_BASE = `You are MindMuse, a psychosocial consultation assistant.
Be direct and action-first. Dispatch tools without narration.
Surface results immediately. User can issue free-form requests.
Maintain clinical neutrality — no celebration, no urgency.

${TOOL_CARD_RULES}`;

function formatContextBlock(summary: ProjectContextSummary | null): string {
  if (!summary) {
    return "[PROJECT CONTEXT: No consultation selected. Prompt user to choose or create a consultation.]";
  }

  return `[PROJECT CONTEXT: ${JSON.stringify(summary)}]`;
}

function formatAccountInjection(state: OnboardingAccountState): string {
  return `[ONBOARDING STATE: ${JSON.stringify({
    phase: state.phase,
    userMode: state.userMode,
    hasConsultation: state.hasConsultation,
    hasMeeting: state.hasMeeting,
    hasInsight: state.hasInsight,
    hasQuotes: state.hasQuotes,
    hasGrouping: state.hasGrouping,
    activeConsultations: state.activeConsultations,
  })}]`;
}

export function buildDynamicSystemPrompt(
  state: OnboardingAccountState,
  contextSummary: ProjectContextSummary | null
): string {
  const base = state.userMode === "returning" ? RETURNING_BASE : ONBOARDING_BASE;
  const blocks =
    state.userMode === "onboarding" ? selectSubPrompts(state) : [];

  return [base, ...blocks, formatContextBlock(contextSummary), formatAccountInjection(state)].join(
    "\n\n"
  );
}

/** @deprecated Use buildDynamicSystemPrompt with account state. */
export function buildSystemPrompt(
  userMode: ChatUserMode,
  contextSummary: ProjectContextSummary | null
): string {
  const base = userMode === "onboarding" ? ONBOARDING_BASE : RETURNING_BASE;
  return `${base}\n\n${formatContextBlock(contextSummary)}`;
}

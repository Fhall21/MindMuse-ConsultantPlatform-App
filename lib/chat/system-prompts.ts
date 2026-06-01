import type { ChatUserMode } from "@/db/schema/chat";
import type { OnboardingAccountState } from "./onboarding-state";
import { selectSubPrompts } from "./onboarding-prompts";
import type { ProjectContextSummary } from "./context";

const TOOL_CARD_RULES = `Tool cards:
- Meeting intake: ALWAYS call intake_text_transcript, intake_audio_transcript, or intake_notes. NEVER write meeting fields as markdown — MeetingConfirmationCard renders from the pending tool result.
- Meeting save: the user confirms via MeetingConfirmationCard (POST /api/meetings). NEVER call confirm_meeting or link_people — those are handled by the UI.
- Theme review: call extract_themes (meeting_id optional — uses lastMeetingId from PROJECT CONTEXT when omitted). If multiple meetings exist, call select_meeting_for_themes or extract_themes without meeting_id to show MeetingPickerCard. NEVER ask the user to re-paste or re-upload a transcript. NEVER list theme labels, descriptions, or confidence in prose — ThemeReviewCard renders from the pending tool result.
- Quote review: call identify_quotes with meeting_id and theme_ids. NEVER list quote text or speakers in prose — QuoteCard renders from the pending tool result.
- Theme grouping: call group_themes with project_id (consultation id) and optional hint. NEVER describe the proposed group in prose — ThemeGroupingCard renders from the pending tool result.
- Canvas preview: call preview_canvas with consultation_id after grouping or when the user asks to see the canvas. NEVER describe node positions in prose — CanvasPreviewCard renders the thumbnail.
- Async outputs: call generate_research_questions, draft_evidence_email, or generate_report when asked. NEVER duplicate generated content in prose — the preview cards render inline.
- Research linking: call link_research_to_themes when linking literature insights to theme groups.
- Clarification: call generate_clarification when notes are ambiguous. NEVER repeat the questions in prose — ClarificationQuestionCard renders from the tool result.
- Consultation setup: direct the user to CreateProjectCard or ProjectSelectionCard in the UI instead of inventing consultation names in prose.
- After any successful card tool call, stay silent or use one short neutral sentence. Do not duplicate data the card already shows.`;

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

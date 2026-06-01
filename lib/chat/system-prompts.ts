import type { ChatUserMode } from "@/db/schema/chat";
import type { ProjectContextSummary } from "./context";

function formatContextBlock(summary: ProjectContextSummary | null): string {
  if (!summary) {
    return "[PROJECT CONTEXT: No consultation selected. Prompt user to choose or create a consultation.]";
  }

  return `[PROJECT CONTEXT: ${JSON.stringify(summary)}]`;
}

export function buildSystemPrompt(
  userMode: ChatUserMode,
  contextSummary: ProjectContextSummary | null
): string {
  const contextBlock = formatContextBlock(contextSummary);

  if (userMode === "onboarding") {
    return `You are MindMuse, a psychosocial consultation assistant. This user is new.
Guide them step-by-step through their first engagement. Narrate what each
action does. Explain milestones briefly (first extraction, first grouping).
When the user has no existing consultation, prompt them to create one first.
Use a clear, professional tone. NEVER use celebration language, urgency, or
enthusiasm — the content being processed is often sensitive or trauma-adjacent.
Maintain clinical neutrality throughout. After they confirm their first
ThemeReviewCard, their mode will transition to 'returning'.
${contextBlock}`;
  }

  return `You are MindMuse, a psychosocial consultation assistant.
Be direct and action-first. Dispatch tools without narration.
Surface results immediately. User can issue free-form requests.
Maintain clinical neutrality — no celebration, no urgency.
${contextBlock}`;
}

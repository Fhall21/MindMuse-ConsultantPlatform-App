import {
  MEETING_SAVED_FOLLOW_UP,
  QUOTE_REVIEW_DONE_FOLLOW_UP,
  THEME_REVIEW_DONE_FOLLOW_UP,
} from "@/lib/chat/onboarding-copy";
import {
  normalizeWorkflowSuggestedResponses,
  type WorkflowSuggestedResponsesPayload,
} from "@/lib/chat/suggested-responses";

const MEETING_SAVED_TEMPLATE: WorkflowSuggestedResponsesPayload = {
  source: "workflow",
  options: [
    {
      label: "Extract themes",
      prefill: "I'm ready — extract themes from the transcript",
      role: "primary",
    },
    {
      label: "Not yet",
      prefill: "Not yet — I'll return to themes later",
      role: "defer",
    },
    {
      label: "What else?",
      prefill: "What else can we do with this meeting?",
      role: "alternate",
    },
  ],
};

const THEME_REVIEW_DONE_TEMPLATE: WorkflowSuggestedResponsesPayload = {
  source: "workflow",
  options: [
    {
      label: "Identify quotes",
      prefill: "I'm ready — identify supporting quotes from the transcript",
      role: "primary",
    },
    {
      label: "Not yet",
      prefill: "Not yet — I'll come back to quotes later",
      role: "defer",
    },
    {
      label: "What else?",
      prefill: "What else can we do next?",
      role: "alternate",
    },
  ],
};

const QUOTE_REVIEW_DONE_TEMPLATE: WorkflowSuggestedResponsesPayload = {
  source: "workflow",
  options: [
    {
      label: "Draft email",
      prefill: "I'm ready — draft the evidence email from the accepted insights from this meeting",
      role: "primary",
    },
    {
      label: "Not yet",
      prefill: "Not yet — I'll come back to the evidence email later",
      role: "defer",
    },
    {
      label: "Adjust quotes",
      prefill: "I want to adjust the saved quotes before drafting the email",
      role: "alternate",
    },
  ],
};

const WORKFLOW_FOLLOW_UP_TEMPLATES = new Map<string, WorkflowSuggestedResponsesPayload>([
  [MEETING_SAVED_FOLLOW_UP, MEETING_SAVED_TEMPLATE],
  [THEME_REVIEW_DONE_FOLLOW_UP, THEME_REVIEW_DONE_TEMPLATE],
  [QUOTE_REVIEW_DONE_FOLLOW_UP, QUOTE_REVIEW_DONE_TEMPLATE],
]);

export function getWorkflowSuggestedResponsesForContent(
  assistantText: string
): WorkflowSuggestedResponsesPayload | null {
  const template = WORKFLOW_FOLLOW_UP_TEMPLATES.get(assistantText.trim());
  if (!template) {
    return null;
  }
  return normalizeWorkflowSuggestedResponses(template);
}

/** @deprecated Use getWorkflowSuggestedResponsesForContent */
export function getTemplateSuggestedResponses(assistantText: string) {
  return getWorkflowSuggestedResponsesForContent(assistantText);
}

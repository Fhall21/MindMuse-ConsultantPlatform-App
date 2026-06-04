export const CARD_CONFIRMATION_ACTIONS = [
  "consultation_created",
  "consultation_selected",
  "meeting_updated",
  "person_linked",
  "insight_created",
  "theme_updated",
  "canvas_updated",
  "research_questions_saved",
  "research_linked",
  "theme_group_saved",
  "email_draft_saved",
  "report_saved",
  "report_exported",
  "literature_review_started",
  "person_unlinked",
  "pending_items_dismissed",
  "meeting_note_attached",
] as const;

export type CardConfirmationAction = (typeof CARD_CONFIRMATION_ACTIONS)[number];

const CARD_CONFIRMATION_MESSAGES: Record<CardConfirmationAction, string> = {
  consultation_created: "Project created. We can start adding meeting material when you're ready.",
  consultation_selected: "Project selected. I'll keep the next steps scoped to this work.",
  meeting_updated: "Meeting updated. I'll use the revised details from here.",
  person_linked: "Person linked. I'll include that connection in this project.",
  insight_created: "Insight added. It's now available with the meeting's other themes.",
  theme_updated: "Theme updated. I'll use the revised label from here.",
  canvas_updated: "Canvas updated. The change is now reflected in the workspace.",
  research_questions_saved: "Research questions saved. They're ready for the next pass.",
  research_linked: "Research linked. It's now attached to the selected themes.",
  theme_group_saved: "Theme group saved. The canvas and project view now share that grouping.",
  email_draft_saved: "Draft saved. You can return to it from the meeting when you're ready.",
  report_saved: "Report saved. It's available from the reports page.",
  report_exported: "Export prepared. Your download should start now.",
  literature_review_started:
    "Literature review started. I'll use the refined question and show progress in research.",
  person_unlinked: "Person unlinked. That meeting connection has been removed.",
  pending_items_dismissed: "Pending items dismissed. I'll leave those out of the next steps.",
  meeting_note_attached: "Meeting note saved. I'll keep it with the meeting context.",
};

export function getCardConfirmationMessage(action: CardConfirmationAction): string {
  return CARD_CONFIRMATION_MESSAGES[action];
}

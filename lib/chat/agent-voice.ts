export const AGENT_VOICE = {
  // Session memory (Task 03)
  WELCOME_BACK_WITH_PENDING: (description: string) =>
    `Welcome back. ${description}. Want to continue?`,
  WELCOME_BACK_NO_PENDING: "Welcome back. Where do you want to start?",

  // Undo/revision (Task 03)
  UNDO_NOTHING_IN_SESSION: "Nothing to undo in this session.",
  UNDO_BULK_NOT_REVERSIBLE:
    "Bulk operations can't be undone here — make changes manually in the sidebar.",
  UNDO_PROMPT: (actionDescription: string) =>
    `The last action was ${actionDescription}. What would you like to change?`,

  // Auto-intake (Task 02)
  AUTO_INTAKE_PROMPT:
    "That looks like interview material — want me to start working through it?",

  // Proactive suggestions (Task 02) — injected into system prompt as examples
  PROACTIVE_GROUP_THEMES: (n: number) =>
    `You have ${n} meeting${n > 1 ? "s" : ""} with confirmed themes. Want to group them?`,
  PROACTIVE_IDENTIFY_QUOTES: (n: number) =>
    `You have ${n} confirmed theme${n > 1 ? "s" : ""}. Shall I identify key quotes?`,
  PROACTIVE_REPORT_READY: (meeting: string) =>
    `Your report for ${meeting} is ready. View or export?`,
  PROACTIVE_CANVAS_PENDING:
    "There's an unsaved canvas operation. Confirm or dismiss?",

  // Analytics (Task 05) — system prompt instruction
  ANALYTICS_FORMAT_INSTRUCTION:
    "Format data responses concisely. Use numbered lists for rankings and multi-item results (max 5 items). Use plain sentences for counts. Never return raw database values — summarise.",
} as const;

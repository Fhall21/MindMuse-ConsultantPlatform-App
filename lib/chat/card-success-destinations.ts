import {
  CARD_CONFIRMATION_ACTIONS,
  type CardConfirmationAction,
} from "@/lib/chat/card-confirmation-copy";
import { INTAKE_CARD_TOOL_NAMES } from "@/lib/chat/tools/intake";

export type CardSuccessContext = {
  meetingId?: string | null;
  consultationId?: string | null;
  reportId?: string | null;
  researchSessionId?: string | null;
};

export type CardSuccessDestination = {
  hasReviewDestination: boolean;
  linkLabel?: string;
  buildHref?: (ctx: CardSuccessContext) => string | null;
};

export type CardSuccessLink = {
  href: string;
  label: string;
};

function meetingHref(meetingId: string, tab?: "analysis" | "capture", hash?: string): string {
  const params = tab ? `?tab=${tab}` : "";
  const fragment = hash ? `#${hash}` : "";
  return `/meetings/${meetingId}${params}${fragment}`;
}

function canvasHref(consultationId: string): string {
  return `/canvas/round/${consultationId}?tab=canvas`;
}

function reportsRoundHref(consultationId: string): string {
  return `/consultations/rounds/${consultationId}?tab=reports`;
}

const MEETING_GENERAL: CardSuccessDestination = {
  hasReviewDestination: true,
  linkLabel: "Open meeting",
  buildHref: (ctx) => (ctx.meetingId ? meetingHref(ctx.meetingId) : null),
};

const MEETING_THEMES: CardSuccessDestination = {
  hasReviewDestination: true,
  linkLabel: "View themes",
  buildHref: (ctx) =>
    ctx.meetingId ? meetingHref(ctx.meetingId, "analysis", "themes") : null,
};

const MEETING_QUOTES: CardSuccessDestination = {
  hasReviewDestination: true,
  linkLabel: "View quotes",
  buildHref: (ctx) =>
    ctx.meetingId ? meetingHref(ctx.meetingId, "analysis", "quotes") : null,
};

const MEETING_EVIDENCE_EMAIL: CardSuccessDestination = {
  hasReviewDestination: true,
  linkLabel: "Open draft",
  buildHref: (ctx) =>
    ctx.meetingId ? meetingHref(ctx.meetingId, "analysis", "evidence-email") : null,
};

const MEETING_NOTES: CardSuccessDestination = {
  hasReviewDestination: true,
  linkLabel: "Open meeting notes",
  buildHref: (ctx) =>
    ctx.meetingId ? meetingHref(ctx.meetingId, "capture", "notes") : null,
};

const CANVAS: CardSuccessDestination = {
  hasReviewDestination: true,
  linkLabel: "View canvas",
  buildHref: (ctx) => (ctx.consultationId ? canvasHref(ctx.consultationId) : null),
};

const REPORT: CardSuccessDestination = {
  hasReviewDestination: true,
  linkLabel: "Open report",
  buildHref: (ctx) => (ctx.reportId ? `/reports/${ctx.reportId}` : null),
};

const REPORTS_ROUND: CardSuccessDestination = {
  hasReviewDestination: true,
  linkLabel: "View reports",
  buildHref: (ctx) =>
    ctx.consultationId ? reportsRoundHref(ctx.consultationId) : null,
};

const RESEARCH: CardSuccessDestination = {
  hasReviewDestination: true,
  linkLabel: "Open literature review",
  buildHref: (ctx) =>
    ctx.researchSessionId ? `/research/${ctx.researchSessionId}` : null,
};

const NO_DESTINATION: CardSuccessDestination = {
  hasReviewDestination: false,
};

const TOOL_DESTINATIONS: Record<string, CardSuccessDestination> = {
  extract_themes: MEETING_THEMES,
  identify_quotes: MEETING_QUOTES,
  show_quotes: MEETING_QUOTES,
  draft_evidence_email: MEETING_EVIDENCE_EMAIL,
  generate_report: REPORTS_ROUND,
  export_report: REPORT,
  group_themes: CANVAS,
  link_insights_to_group: CANVAS,
  preview_canvas: CANVAS,
  manipulate_canvas: CANVAS,
  generate_research_questions: CANVAS,
  link_research_to_themes: CANVAS,
  prepare_literature_review: RESEARCH,
  link_person_to_consultation: MEETING_GENERAL,
  unlink_person_from_meeting: MEETING_GENERAL,
  create_insight: MEETING_THEMES,
  edit_meeting: MEETING_GENERAL,
  edit_theme: MEETING_THEMES,
  attach_meeting_note: MEETING_NOTES,
  show_report: REPORT,
  select_meeting_for_themes: NO_DESTINATION,
  select_meeting_for_action: NO_DESTINATION,
  generate_clarification: NO_DESTINATION,
  ask_user_choice: NO_DESTINATION,
  bulk_dismiss_pending: NO_DESTINATION,
  show_audit_trail: NO_DESTINATION,
  create_project: CANVAS,
};

for (const toolName of INTAKE_CARD_TOOL_NAMES) {
  TOOL_DESTINATIONS[toolName] = MEETING_GENERAL;
}

const CONFIRMATION_DESTINATIONS: Record<CardConfirmationAction, CardSuccessDestination> = {
  consultation_created: CANVAS,
  consultation_selected: NO_DESTINATION,
  meeting_updated: MEETING_GENERAL,
  person_linked: MEETING_GENERAL,
  insight_created: MEETING_THEMES,
  theme_updated: MEETING_THEMES,
  canvas_updated: CANVAS,
  research_questions_saved: CANVAS,
  research_linked: CANVAS,
  theme_group_saved: CANVAS,
  email_draft_saved: MEETING_EVIDENCE_EMAIL,
  report_saved: REPORTS_ROUND,
  report_exported: REPORT,
  literature_review_started: RESEARCH,
  person_unlinked: MEETING_GENERAL,
  pending_items_dismissed: NO_DESTINATION,
  meeting_note_attached: MEETING_NOTES,
};

export function getCardSuccessDestinationForTool(
  toolName: string
): CardSuccessDestination {
  return TOOL_DESTINATIONS[toolName] ?? NO_DESTINATION;
}

export function getCardSuccessDestinationForConfirmation(
  action: CardConfirmationAction
): CardSuccessDestination {
  return CONFIRMATION_DESTINATIONS[action];
}

export function resolveCardSuccessLink(
  destination: CardSuccessDestination,
  ctx: CardSuccessContext
): CardSuccessLink | null {
  if (!destination.hasReviewDestination || !destination.buildHref || !destination.linkLabel) {
    return null;
  }
  const href = destination.buildHref(ctx);
  if (!href) {
    return null;
  }
  return { href, label: destination.linkLabel };
}

export function resolveCardSuccessLinkForTool(
  toolName: string,
  ctx: CardSuccessContext
): CardSuccessLink | null {
  return resolveCardSuccessLink(getCardSuccessDestinationForTool(toolName), ctx);
}

export function resolveCardSuccessLinkForConfirmation(
  action: CardConfirmationAction,
  ctx: CardSuccessContext
): CardSuccessLink | null {
  return resolveCardSuccessLink(getCardSuccessDestinationForConfirmation(action), ctx);
}

/** Read IDs commonly stored on tool result output after completion. */
export function readCardSuccessContextFromOutput(output: unknown): CardSuccessContext {
  if (!output || typeof output !== "object") {
    return {};
  }
  const record = output as Record<string, unknown>;
  const meetingRecord =
    record.meeting_record && typeof record.meeting_record === "object"
      ? (record.meeting_record as Record<string, unknown>)
      : null;

  const meetingId =
    (typeof record.meeting_id === "string" ? record.meeting_id : null) ??
    (typeof meetingRecord?.id === "string" ? meetingRecord.id : null);

  const consultationId =
    (typeof record.consultation_id === "string" ? record.consultation_id : null) ??
    (typeof record.project_id === "string" ? record.project_id : null) ??
    (typeof meetingRecord?.projectId === "string" ? meetingRecord.projectId : null);

  const reportId =
    typeof record.report_id === "string"
      ? record.report_id
      : typeof record.draft_id === "string"
        ? record.draft_id
        : null;

  const researchSessionId =
    typeof record.research_session_id === "string" ? record.research_session_id : null;

  return {
    meetingId,
    consultationId,
    reportId,
    researchSessionId,
  };
}

export function mergeCardSuccessContext(
  ...sources: Array<CardSuccessContext | undefined>
): CardSuccessContext {
  const merged: CardSuccessContext = {};
  for (const source of sources) {
    if (!source) continue;
    if (source.meetingId) merged.meetingId = source.meetingId;
    if (source.consultationId) merged.consultationId = source.consultationId;
    if (source.reportId) merged.reportId = source.reportId;
    if (source.researchSessionId) merged.researchSessionId = source.researchSessionId;
  }
  return merged;
}

/** Ensures every confirmation action is explicitly registered (tests rely on this). */
export const CARD_CONFIRMATION_DESTINATION_KEYS = CARD_CONFIRMATION_ACTIONS;

export function getCardSuccessShellProps(
  toolName: string,
  options: {
    output?: unknown;
    meetingId?: string | null;
    consultationId?: string | null;
    reportId?: string | null;
    researchSessionId?: string | null;
  } = {}
): { successLink: CardSuccessLink | null } {
  const ctx = mergeCardSuccessContext(
    readCardSuccessContextFromOutput(options.output),
    {
      meetingId: options.meetingId,
      consultationId: options.consultationId,
      reportId: options.reportId,
      researchSessionId: options.researchSessionId,
    }
  );
  return {
    successLink: resolveCardSuccessLinkForTool(toolName, ctx),
  };
}

export function readMeetingIdFromToolInput(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const meetingId = (input as Record<string, unknown>).meeting_id;
  return typeof meetingId === "string" ? meetingId : undefined;
}

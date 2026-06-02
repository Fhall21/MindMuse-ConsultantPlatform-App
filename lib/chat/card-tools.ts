import { INTAKE_CARD_TOOL_NAMES } from "./tools/intake";
import { parseToolMessageContent } from "./ui-messages";

/** Tools whose results render inline cards — never duplicate in assistant prose. */
export const CHAT_CARD_TOOL_NAMES = new Set<string>([
  ...INTAKE_CARD_TOOL_NAMES,
  "extract_themes",
  "select_meeting_for_themes",
  "identify_quotes",
  "generate_clarification",
  "group_themes",
  "link_insights_to_group",
  "preview_canvas",
  "generate_research_questions",
  "draft_evidence_email",
  "generate_report",
  "link_research_to_themes",
  // Sprint 22 Task 01
  "select_meeting_for_action",
  "link_person_to_consultation",
  "create_insight",
  "show_report",
  "edit_meeting",
  "edit_theme",
  "show_audit_trail",
  "export_report",
  "manipulate_canvas",
  "prepare_literature_review",
  "unlink_person_from_meeting",
  "bulk_dismiss_pending",
]);

/** Internal agent tools — never render ToolResultFallbackCard in the thread. */
export const CHAT_HIDDEN_THREAD_TOOL_NAMES = new Set<string>([
  "confirm_meeting",
  "link_people",
]);

export function isHiddenThreadToolName(toolName: string): boolean {
  return CHAT_HIDDEN_THREAD_TOOL_NAMES.has(toolName);
}

export function isChatCardToolName(toolName: string): boolean {
  return CHAT_CARD_TOOL_NAMES.has(toolName);
}

const THEME_PICKER_SUPERSEDING_TOOL_NAMES = new Set([
  "edit_theme",
  "edit_meeting",
  "create_insight",
  "link_person_to_consultation",
  "show_report",
  "show_audit_trail",
  "export_report",
  "manipulate_canvas",
]);

export function shouldHideSupersededThemePicker(
  messages: Array<{ role: string; toolName?: string; status?: string }>,
  index: number
): boolean {
  const candidate = messages[index];
  if (
    candidate?.toolName !== "select_meeting_for_themes" ||
    candidate.status === "success" ||
    candidate.status === "dismissed"
  ) {
    return false;
  }

  for (let nextIndex = index + 1; nextIndex < messages.length; nextIndex += 1) {
    const next = messages[nextIndex];
    if (next?.role === "user") {
      break;
    }
    if (next?.toolName && THEME_PICKER_SUPERSEDING_TOOL_NAMES.has(next.toolName)) {
      return true;
    }
  }

  return false;
}

export function messageContentIsCardTool(content: string): boolean {
  const meta = parseToolMessageContent(content);
  return meta ? isChatCardToolName(meta.toolName) : false;
}

export function currentTurnMessages(
  messages: Array<{ role: string; content: string }>,
  lookback = 12
): Array<{ role: string; content: string }> {
  const recent = messages.slice(-lookback);
  let lastUserIndex = -1;
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    if (recent[index]?.role === "user") {
      lastUserIndex = index;
      break;
    }
  }
  return lastUserIndex >= 0 ? recent.slice(lastUserIndex + 1) : recent;
}

export async function sessionTurnIncludesCardTool(
  messages: Array<{ role: string; content: string }>,
  lookback = 12
): Promise<boolean> {
  return currentTurnMessages(messages, lookback).some(
    (message) => message.role === "tool" && messageContentIsCardTool(message.content)
  );
}

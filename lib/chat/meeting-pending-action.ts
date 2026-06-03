import { z } from "zod";

export const meetingPendingActionSchema = z.enum([
  "identify_quotes",
  "show_quotes",
  "extract_themes",
  "draft_evidence_email",
  "create_insight",
  "link_person_to_consultation",
  "edit_meeting",
  "unlink_person_from_meeting",
]);

export type MeetingPendingAction = z.infer<typeof meetingPendingActionSchema>;

export const MEETING_PICKER_TOOL_NAMES = [
  "select_meeting_for_action",
  "select_meeting_for_themes",
] as const;

export type MeetingPickerToolName = (typeof MEETING_PICKER_TOOL_NAMES)[number];

export function isMeetingPickerToolName(name: string): name is MeetingPickerToolName {
  return (MEETING_PICKER_TOOL_NAMES as readonly string[]).includes(name);
}

export function defaultPendingActionForPickerTool(
  toolName: MeetingPickerToolName
): MeetingPendingAction {
  return toolName === "select_meeting_for_themes" ? "extract_themes" : "identify_quotes";
}

export function inferMeetingPendingAction(userMessage: string): MeetingPendingAction | null {
  const lower = userMessage.toLowerCase();

  if (/\b(show|review|open|highlight|add)\b.*\bquotes?\b|\bquotes?\b.*\b(review|panel|highlight)\b/.test(lower)) {
    return "show_quotes";
  }
  if (/\b(quotes?|key quotes?|extract quotes?|identify quotes?)\b/.test(lower)) {
    return "identify_quotes";
  }
  if (/\b(extract|pull|find|identify)\b.*\bthemes?\b|\bthemes?\b.*\b(extract|from)\b/.test(lower)) {
    return "extract_themes";
  }
  if (/\b(evidence email|draft email|follow[- ]?up email|email draft)\b/.test(lower)) {
    return "draft_evidence_email";
  }
  if (/\b(add|create)\b.*\b(insight|theme)\b/.test(lower)) {
    return "create_insight";
  }
  if (/\b(link|connect)\b.*\b(person|people)\b/.test(lower)) {
    return "link_person_to_consultation";
  }
  if (/\b(rename|edit|change)\b.*\bmeeting\b/.test(lower)) {
    return "edit_meeting";
  }
  if (/\b(unlink|remove)\b.*\b(person|people)\b/.test(lower)) {
    return "unlink_person_from_meeting";
  }

  return null;
}

export function readMeetingPendingAction(params: {
  output: unknown;
  input?: unknown;
  pickerToolName?: string;
}): MeetingPendingAction | null {
  const fromRecord = (value: unknown): MeetingPendingAction | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const parsed = meetingPendingActionSchema.safeParse(
      (value as Record<string, unknown>).pending_action
    );
    return parsed.success ? parsed.data : null;
  };

  const fromOutput = fromRecord(params.output);
  if (fromOutput) {
    return fromOutput;
  }

  const fromInput = fromRecord(params.input);
  if (fromInput) {
    return fromInput;
  }

  if (params.pickerToolName && isMeetingPickerToolName(params.pickerToolName)) {
    return defaultPendingActionForPickerTool(params.pickerToolName);
  }

  return null;
}

export function readMeetingActionParams(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  const record = input as Record<string, unknown>;
  const params = record.action_params;
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return {};
  }
  return params as Record<string, unknown>;
}

export function attachPendingActionToPickerOutput<
  T extends { consultation_id: string; meetings: unknown[] },
>(
  output: T,
  pendingAction: MeetingPendingAction,
  actionParams?: Record<string, unknown>
): T & { pending_action: MeetingPendingAction; action_params?: Record<string, unknown> } {
  return {
    ...output,
    pending_action: pendingAction,
    ...(actionParams && Object.keys(actionParams).length > 0
      ? { action_params: actionParams }
      : {}),
  };
}

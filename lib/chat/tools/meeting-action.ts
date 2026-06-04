import { z } from "zod";
import { meetingPendingActionSchema } from "../meeting-pending-action";

export const selectMeetingForActionSchema = z.object({
  consultation_id: z.string().uuid().optional(),
  pending_action: meetingPendingActionSchema.optional().describe(
    "The card workflow to run after the user confirms a meeting (e.g. identify_quotes, extract_themes, draft_evidence_email)."
  ),
  action_params: z.record(z.string(), z.unknown()).optional(),
});

export function mergeMeetingActionSelection(
  output: unknown,
  meetingId: string
): Record<string, unknown> {
  const existing =
    output && typeof output === "object" && !Array.isArray(output)
      ? (output as Record<string, unknown>)
      : {};
  const selected = Array.isArray(existing.meetings)
    ? existing.meetings.find(
        (meeting) =>
          meeting &&
          typeof meeting === "object" &&
          (meeting as { id?: unknown }).id === meetingId
      )
    : null;
  return {
    ...existing,
    meeting_id: meetingId,
    ...(selected && typeof selected === "object"
      ? { selected_meeting: selected as Record<string, unknown> }
      : {}),
  };
}

export const MEETING_ACTION_CONTINUATION_PREFIX = "Use the selected meeting,";

export function buildMeetingActionContinuation(meetingTitle: string): string {
  return `Use the selected meeting, "${meetingTitle.replaceAll('"', "'")}", for that.`;
}

export function isMeetingActionContinuation(text: string): boolean {
  const trimmed = text.trimStart();
  return (
    trimmed.startsWith(MEETING_ACTION_CONTINUATION_PREFIX) ||
    /\b(this|current|selected)\s+meeting\b/i.test(trimmed)
  );
}

export function parseMeetingTitleFromContinuation(text: string): string | null {
  const trimmed = text.trim();
  const match = trimmed.match(
    /^Use the selected meeting,\s*["'](.+?)["']\s*,?\s*for that\.?\s*$/i
  );
  return match?.[1]?.trim() ?? null;
}

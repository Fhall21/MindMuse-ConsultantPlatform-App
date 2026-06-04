import { z } from "zod";
import { meetingPendingActionSchema } from "../meeting-pending-action";

export const selectMeetingForThemesSchema = z.object({
  consultation_id: z.string().uuid().optional(),
  pending_action: meetingPendingActionSchema.optional(),
});

export interface MeetingPickerItem {
  id: string;
  title: string;
  date: string | null;
}

export interface MeetingPickerOutput {
  consultation_id: string;
  meetings: MeetingPickerItem[];
  pending_action?: string;
  action_params?: Record<string, unknown>;
  meeting_id?: string;
}

export function readMeetingPickerOutput(output: unknown): MeetingPickerOutput | null {
  if (!output || typeof output !== "object") {
    return null;
  }

  const record = output as Record<string, unknown>;
  if (typeof record.consultation_id !== "string") {
    return null;
  }

  if (!Array.isArray(record.meetings)) {
    return null;
  }

  const meetings: MeetingPickerItem[] = [];
  for (const item of record.meetings) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.title !== "string") {
      continue;
    }
    meetings.push({
      id: row.id,
      title: row.title,
      date: typeof row.date === "string" ? row.date : null,
    });
  }

  if (meetings.length === 0) {
    return null;
  }

  return {
    consultation_id: record.consultation_id,
    meetings,
    ...(typeof record.pending_action === "string"
      ? { pending_action: record.pending_action }
      : {}),
    ...(record.action_params && typeof record.action_params === "object"
      ? { action_params: record.action_params as Record<string, unknown> }
      : {}),
    ...(typeof record.meeting_id === "string" ? { meeting_id: record.meeting_id } : {}),
  };
}

export function buildMeetingPickerOutput(params: {
  consultationId: string;
  meetings: MeetingPickerItem[];
}): MeetingPickerOutput {
  return {
    consultation_id: params.consultationId,
    meetings: params.meetings,
  };
}

/** True when a tool returned meeting-picker payload instead of a follow-up card. */
export function isMeetingPickerToolResult(value: unknown): boolean {
  const picker = readMeetingPickerOutput(value);
  return Boolean(picker && picker.meetings.length > 0 && !picker.meeting_id);
}

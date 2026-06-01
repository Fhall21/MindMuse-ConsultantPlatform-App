import { z } from "zod";

export const selectMeetingForThemesSchema = z.object({
  consultation_id: z.string().uuid().optional(),
});

export interface MeetingPickerItem {
  id: string;
  title: string;
  date: string | null;
}

export interface MeetingPickerOutput {
  consultation_id: string;
  meetings: MeetingPickerItem[];
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

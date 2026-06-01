import { z } from "zod";

export const editMeetingSchema = z.object({
  meeting_id: z.string().uuid().optional(),
  consultation_id: z.string().uuid().optional(),
  title_hint: z.string().optional(),
  date_hint: z.string().optional(),
});

export interface MeetingEditOutput {
  meeting_id: string;
  title: string;
  meeting_date: string | null;
  meeting_type_id: string | null;
}

export function readMeetingEditOutput(output: unknown): MeetingEditOutput | null {
  if (!output || typeof output !== "object") return null;
  const r = output as Record<string, unknown>;
  if (typeof r.meeting_id !== "string" || typeof r.title !== "string") return null;
  return {
    meeting_id: r.meeting_id,
    title: r.title,
    meeting_date: typeof r.meeting_date === "string" ? r.meeting_date : null,
    meeting_type_id: typeof r.meeting_type_id === "string" ? r.meeting_type_id : null,
  };
}

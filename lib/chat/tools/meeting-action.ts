import { z } from "zod";

export const selectMeetingForActionSchema = z.object({
  consultation_id: z.string().uuid().optional(),
});

export function mergeMeetingActionSelection(
  output: unknown,
  meetingId: string
): Record<string, unknown> {
  const existing =
    output && typeof output === "object" && !Array.isArray(output)
      ? (output as Record<string, unknown>)
      : {};
  return { ...existing, meeting_id: meetingId };
}

export function buildMeetingActionContinuation(meetingTitle: string): string {
  return `Use the selected meeting, "${meetingTitle.replaceAll('"', "'")}", for that.`;
}

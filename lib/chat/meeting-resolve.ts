import { listMeetingsForConsultation, getMeetingForUser } from "@/lib/data/domain-read";
import { loadMeetingTranscript } from "./themes-db";
import {
  extractMeetingHintFromMessage,
  filterMeetingsByTitleHint,
  titleMatchesMeetingHint,
  type MeetingPickerCandidate,
} from "./meeting-hints";

export type { MeetingPickerCandidate } from "./meeting-hints";
export { extractMeetingHintFromMessage, filterMeetingsByTitleHint } from "./meeting-hints";

export type MeetingResolveResult =
  | { ok: true; meetingId: string }
  | { ok: false; needsPicker: true; error?: string }
  | { ok: false; needsPicker: false; error: string };

export async function resolveMeetingForConsultationAction(params: {
  userId: string;
  consultationId: string | null;
  meetingId?: string;
  userMessage?: string | null;
}): Promise<MeetingResolveResult> {
  if (!params.consultationId) {
    return {
      ok: false,
      needsPicker: false,
      error: "No consultation selected. Ask the user to choose a consultation first.",
    };
  }

  const meetings = await listMeetingsForConsultation(params.consultationId, params.userId);
  const pickerMeetings: MeetingPickerCandidate[] = meetings.map((meeting) => ({
    id: meeting.id,
    title: meeting.title,
    date: meeting.meeting_date ?? null,
  }));

  if (meetings.length === 0) {
    return {
      ok: false,
      needsPicker: false,
      error: "No meetings found in this consultation.",
    };
  }

  const hint =
    params.userMessage !== undefined && params.userMessage !== null
      ? extractMeetingHintFromMessage(params.userMessage)
      : null;

  if (params.meetingId) {
    const direct = await loadMeetingTranscript(params.userId, params.meetingId);
    if (!direct.ok) {
      if (pickerMeetings.length > 1) {
        return { ok: false, needsPicker: true };
      }
      return { ok: false, needsPicker: false, error: direct.error };
    }

    if (hint) {
      const meeting = await getMeetingForUser(params.meetingId, params.userId);
      if (meeting && !titleMatchesMeetingHint(meeting.title, hint)) {
        return { ok: false, needsPicker: true };
      }
    }

    return { ok: true, meetingId: params.meetingId };
  }

  if (pickerMeetings.length === 1) {
    return { ok: true, meetingId: pickerMeetings[0].id };
  }

  if (hint) {
    const matched = filterMeetingsByTitleHint(pickerMeetings, hint);
    if (matched.length === 1) {
      return { ok: true, meetingId: matched[0].id };
    }
    return { ok: false, needsPicker: true };
  }

  return { ok: false, needsPicker: true };
}

import { listMeetingsForConsultation, getMeetingForUser } from "@/lib/data/domain-read";
import { loadMeetingTranscript } from "./themes-db";
import {
  isMeetingActionContinuation,
  parseMeetingTitleFromContinuation,
} from "./tools/meeting-action";
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

  const userMessage = params.userMessage?.trim() ?? null;

  if (userMessage && isMeetingActionContinuation(userMessage)) {
    const title = parseMeetingTitleFromContinuation(userMessage);
    if (title) {
      const byTitle = pickerMeetings.filter((meeting) => meeting.title === title);
      if (byTitle.length === 1) {
        return { ok: true, meetingId: byTitle[0].id };
      }
    }
    if (params.meetingId) {
      return { ok: true, meetingId: params.meetingId };
    }
    return {
      ok: false,
      needsPicker: false,
      error:
        "Meeting was already selected. Continue with show_quotes or identify_quotes using that meeting_id per the user's request.",
    };
  }

  const hint =
    userMessage !== null ? extractMeetingHintFromMessage(userMessage) : null;

  if (params.meetingId) {
    const meeting = await getMeetingForUser(params.meetingId, params.userId);
    if (!meeting || meeting.consultation_id !== params.consultationId) {
      return { ok: false, needsPicker: false, error: "Meeting not found or access denied." };
    }

    const direct = await loadMeetingTranscript(params.userId, params.meetingId);
    if (!direct.ok) {
      // Explicit meeting_id was already chosen — re-picking cannot fix a missing transcript.
      return { ok: false, needsPicker: false, error: direct.error };
    }

    if (hint && !titleMatchesMeetingHint(meeting.title, hint)) {
      // User or picker already locked this meeting — do not loop back to the picker.
      return { ok: true, meetingId: params.meetingId };
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

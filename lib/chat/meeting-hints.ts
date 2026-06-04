export interface MeetingPickerCandidate {
  id: string;
  title: string;
  date: string | null;
}

const MEETING_HINT_PATTERNS = [
  /\bchat\s+with\s+([A-Za-z][A-Za-z'-]{1,30})\b/i,
  /\bmeeting\s+with\s+([A-Za-z][A-Za-z'-]{1,30})\b/i,
  /\b(?:with|from)\s+([A-Za-z][A-Za-z'-]{1,30})\b/i,
  /\b([A-Za-z][A-Za-z'-]{1,30})'?s\s+meeting\b/i,
];

const MEETING_HINT_STOP_WORDS = new Set(["the", "a", "an", "my", "our", "this", "that"]);

/** Pull a person/name hint from free text (e.g. "chat with Jake"). */
export function extractMeetingHintFromMessage(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) {
    return null;
  }

  for (const pattern of MEETING_HINT_PATTERNS) {
    const match = trimmed.match(pattern);
    const candidate = match?.[1]?.trim();
    if (
      candidate &&
      candidate.length >= 2 &&
      !MEETING_HINT_STOP_WORDS.has(candidate.toLowerCase())
    ) {
      return candidate;
    }
  }

  return null;
}

export function filterMeetingsByTitleHint(
  meetings: MeetingPickerCandidate[],
  hint: string
): MeetingPickerCandidate[] {
  const needle = hint.toLowerCase();
  return meetings.filter((meeting) => meeting.title.toLowerCase().includes(needle));
}

export function titleMatchesMeetingHint(title: string, hint: string): boolean {
  return title.toLowerCase().includes(hint.toLowerCase());
}

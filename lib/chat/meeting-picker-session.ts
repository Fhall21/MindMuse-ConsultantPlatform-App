import { loadRecentChatMessages, loadToolResultsForSession } from "./persist";
import { isMeetingActionContinuation } from "./tools/meeting-action";
import { readMeetingPickerOutput } from "./tools/meetings-picker";

export async function findPriorUserRequestMessage(sessionId: string): Promise<string | null> {
  const messages = await loadRecentChatMessages(sessionId);
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") {
      continue;
    }
    const text = message.content.trim();
    if (!text || isMeetingActionContinuation(text)) {
      continue;
    }
    return text;
  }
  return null;
}

export async function getLatestMeetingActionSelection(sessionId: string): Promise<{
  meetingId: string;
  toolResultId: string;
} | null> {
  const results = await loadToolResultsForSession(sessionId);
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const row = results[index];
    if (row.toolName !== "select_meeting_for_action" || row.status !== "success") {
      continue;
    }
    const meetingId =
      typeof row.output === "object" && row.output
        ? ((row.output as Record<string, unknown>).meeting_id as string | undefined)
        : undefined;
    if (meetingId && readMeetingPickerOutput(row.output)) {
      return { meetingId, toolResultId: row.id };
    }
  }
  return null;
}

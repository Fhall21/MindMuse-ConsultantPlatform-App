import type { ChatToolMessageMeta } from "@/lib/chat/ui-messages";
import type { ClarificationQuestion, MeetingDraft } from "@/lib/chat/tools/intake";
export { readThemeReviewOutput } from "@/lib/chat/tools/themes";
export type { ThemeReviewOutput } from "@/lib/chat/tools/themes";
export { readQuoteReviewOutput } from "@/lib/chat/tools/quotes";
export type { QuoteReviewOutput } from "@/lib/chat/tools/quotes";

export interface ChatCardProps {
  tool: ChatToolMessageMeta;
  messageId: string;
  sessionId?: string | null;
  onUpdated?: () => void;
}

export function readMeetingDraft(output: unknown): MeetingDraft | null {
  if (!output || typeof output !== "object") {
    return null;
  }

  const record = output as Record<string, unknown>;
  if (
    typeof record.title !== "string" ||
    typeof record.date !== "string" ||
    !Array.isArray(record.participants) ||
    typeof record.notes_preview !== "string"
  ) {
    return null;
  }

  return {
    title: record.title,
    date: record.date,
    participants: record.participants.filter(
      (name): name is string => typeof name === "string"
    ),
    notes_preview: record.notes_preview,
    project_id:
      typeof record.project_id === "string" ? record.project_id : undefined,
    source_text:
      typeof record.source_text === "string" ? record.source_text : undefined,
    intake_kind:
      record.intake_kind === "transcript" ||
      record.intake_kind === "audio" ||
      record.intake_kind === "notes"
        ? record.intake_kind
        : undefined,
  };
}

export function readClarificationQuestions(output: unknown): ClarificationQuestion[] {
  if (Array.isArray(output)) {
    return output.filter(
      (item): item is ClarificationQuestion =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as ClarificationQuestion).question === "string"
    );
  }

  if (output && typeof output === "object" && "questions" in output) {
    return readClarificationQuestions((output as { questions: unknown }).questions);
  }

  return [];
}

import type { ChatToolMessageMeta } from "@/lib/chat/ui-messages";
import type { ClarificationQuestion, MeetingDraft } from "@/lib/chat/tools/intake";
export { readThemeReviewOutput } from "@/lib/chat/tools/themes";
export type { ThemeReviewOutput } from "@/lib/chat/tools/themes";
export { readQuoteReviewOutput } from "@/lib/chat/tools/quotes";
export type { QuoteReviewOutput } from "@/lib/chat/tools/quotes";
export { readGroupingReviewOutput } from "@/lib/chat/tools/grouping";
export type { GroupingReviewOutput } from "@/lib/chat/tools/grouping";
export { readCanvasLayoutPreview } from "@/lib/chat/tools/canvas";
export type { CanvasLayoutPreview } from "@/lib/chat/tools/canvas";
export {
  readEmailDraftReviewOutput,
  readReportDraftReviewOutput,
  readResearchQuestionReviewOutput,
  readResearchThemeLinkProposal,
} from "@/lib/chat/tools/async-actions";

export interface ChatCardProps {
  tool: ChatToolMessageMeta;
  messageId: string;
  sessionId?: string | null;
  onUpdated?: () => void;
  /** Returns true when the message was sent to the chat model. */
  onSubmitText?: (text: string) => boolean | Promise<boolean>;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  return typeof record[key] === "string" ? record[key] : undefined;
}

export function readMeetingDraft(output: unknown): MeetingDraft | null {
  if (!output || typeof output !== "object") {
    return null;
  }

  const record = output as Record<string, unknown>;

  // POST /api/meetings success shape: { meeting_draft, meeting_record }
  if (record.meeting_draft && typeof record.meeting_draft === "object") {
    return readMeetingDraft(record.meeting_draft);
  }

  if (
    typeof record.title !== "string" ||
    typeof record.date !== "string" ||
    !Array.isArray(record.participants)
  ) {
    return null;
  }

  return {
    title: record.title,
    date: record.date,
    participants: record.participants.filter(
      (name): name is string => typeof name === "string"
    ),
    notes_preview:
      typeof record.notes_preview === "string" ? record.notes_preview : "",
    project_id: readOptionalString(record, "project_id"),
    source_text: readOptionalString(record, "source_text"),
    intake_kind:
      record.intake_kind === "transcript" ||
      record.intake_kind === "audio" ||
      record.intake_kind === "notes"
        ? record.intake_kind
        : undefined,
    meeting_type_id: readOptionalString(record, "meeting_type_id"),
    suggested_type_code: readOptionalString(record, "suggested_type_code"),
    person_ids: Array.isArray(record.person_ids)
      ? record.person_ids.filter((id): id is string => typeof id === "string")
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

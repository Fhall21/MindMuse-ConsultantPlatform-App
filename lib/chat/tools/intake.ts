import { z } from "zod";
import { extractSpeakerNamesFromTranscript } from "@/lib/meetings/transcript-speakers";

export const meetingDraftSchema = z.object({
  title: z.string().min(1),
  date: z.string().min(1),
  participants: z.array(z.string()),
  notes_preview: z.string().optional().default(""),
  project_id: z.string().uuid().optional(),
  /** Full source text persisted on confirm (transcript or notes). */
  source_text: z.string().optional(),
  intake_kind: z.enum(["transcript", "audio", "notes"]).optional(),
  meeting_type_id: z.string().uuid().optional(),
  suggested_type_code: z.string().optional(),
  person_ids: z.array(z.string().uuid()).optional(),
});

export type MeetingDraft = z.infer<typeof meetingDraftSchema>;

export const meetingRecordSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  date: z.string(),
  projectId: z.string().uuid(),
});

export type MeetingRecord = z.infer<typeof meetingRecordSchema>;

export const clarificationQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  field: z.string(),
});

export type ClarificationQuestion = z.infer<typeof clarificationQuestionSchema>;

export const linkedPersonRecordSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  matched: z.boolean(),
  created: z.boolean(),
});

export type LinkedPersonRecord = z.infer<typeof linkedPersonRecordSchema>;

export const intakeTextTranscriptSchema = z.object({
  text: z.string().min(1),
  project_id: z.string().uuid().optional(),
});

export const intakeAudioTranscriptSchema = z
  .object({
    artifactId: z.string().uuid().optional(),
    text: z.string().min(1).optional(),
    project_id: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.artifactId || value.text?.trim()), {
    message: "Provide artifactId or transcribed text",
  });

export const intakeNotesSchema = z
  .object({
    artifactId: z.string().uuid().optional(),
    text: z.string().min(1).optional(),
    project_id: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.artifactId || value.text?.trim()), {
    message: "Provide artifactId or notes text",
  });

export const confirmMeetingSchema = z.object({
  meeting_draft: meetingDraftSchema,
  project_id: z.string().uuid(),
  tool_result_id: z.string().uuid().optional(),
});

export const linkPeopleSchema = z.object({
  meeting_id: z.string().uuid(),
  participant_names: z.array(z.string().min(1)).min(1),
});

export const generateClarificationSchema = z.object({
  notes_text: z.string().min(1),
  meeting_id: z.string().uuid(),
});

export const INTAKE_CARD_TOOL_NAMES = new Set([
  "intake_text_transcript",
  "intake_audio_transcript",
  "intake_notes",
]);

export function previewText(text: string, maxLength = 280): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

export function normalizeMeetingDraft(raw: unknown, fallbackText?: string): MeetingDraft {
  const record =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const sourceText =
    typeof record.source_text === "string"
      ? record.source_text
      : typeof record.transcript === "string"
        ? record.transcript
        : fallbackText;

  const title =
    typeof record.title === "string" && record.title.trim()
      ? record.title.trim()
      : "Untitled meeting";

  const date =
    typeof record.date === "string" && record.date
      ? record.date
      : typeof record.suggested_date === "string" && record.suggested_date
        ? `${record.suggested_date}T12:00:00.000Z`
        : new Date().toISOString();

  let participants = Array.isArray(record.participants)
    ? record.participants.filter((name): name is string => typeof name === "string")
    : Array.isArray(record.suggested_people)
      ? record.suggested_people.filter((name): name is string => typeof name === "string")
      : [];

  if (participants.length === 0 && sourceText) {
    participants = extractSpeakerNamesFromTranscript(sourceText);
  }

  const notesPreview =
    typeof record.notes_preview === "string" && record.notes_preview.trim()
      ? record.notes_preview
      : sourceText
        ? previewText(sourceText)
        : "";

  return meetingDraftSchema.parse({
    title,
    date,
    participants,
    notes_preview: notesPreview,
    project_id:
      typeof record.project_id === "string"
        ? record.project_id
        : typeof record.projectId === "string"
          ? record.projectId
          : undefined,
    source_text: sourceText,
    intake_kind:
      record.intake_kind === "transcript" ||
      record.intake_kind === "audio" ||
      record.intake_kind === "notes"
        ? record.intake_kind
        : undefined,
    meeting_type_id:
      typeof record.meeting_type_id === "string"
        ? record.meeting_type_id
        : typeof record.meetingTypeId === "string"
          ? record.meetingTypeId
          : undefined,
    suggested_type_code:
      typeof record.suggested_type_code === "string"
        ? record.suggested_type_code
        : undefined,
    person_ids: Array.isArray(record.person_ids)
      ? record.person_ids.filter((id): id is string => typeof id === "string")
      : undefined,
  });
}

export function mapClarificationQuestions(raw: unknown): ClarificationQuestion[] {
  const payload =
    raw && typeof raw === "object" && "questions" in raw
      ? (raw as { questions?: unknown }).questions
      : raw;

  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const record = item as Record<string, unknown>;
      const question = typeof record.question === "string" ? record.question : "";
      if (!question.trim()) {
        return null;
      }
      const field =
        typeof record.field === "string"
          ? record.field
          : typeof record.type === "string"
            ? record.type
            : typeof record.theme_label === "string"
              ? record.theme_label
              : "general";

      return {
        id:
          typeof record.id === "string"
            ? record.id
            : `clarification-${index + 1}`,
        question,
        field,
      };
    })
    .filter((item): item is ClarificationQuestion => item !== null);
}

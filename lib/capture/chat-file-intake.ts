import { parseTranscriptFile } from "@/lib/transcript-file-parser";
import { transcribeAudioFile, isAudioFile } from "./audio-transcribe";
import { extractOcrTextFromFile, isNotesImageFile } from "./ocr-image";

export type ChatCaptureKind = "transcript" | "notes";
export type ResolvedIntakeKind = "transcript" | "audio" | "notes";

const INTAKE_TOOL_BY_KIND: Record<ResolvedIntakeKind, string> = {
  transcript: "intake_text_transcript",
  audio: "intake_audio_transcript",
  notes: "intake_notes",
};

/**
 * Transform an uploaded file using the same extraction routes as meeting capture,
 * returning plain text for chat intake tools.
 */
export async function captureFileForChatIntake(
  file: File,
  kind: ChatCaptureKind
): Promise<{ intakeKind: ResolvedIntakeKind; text: string }> {
  if (kind === "transcript") {
    if (isAudioFile(file)) {
      return { intakeKind: "audio", text: await transcribeAudioFile(file) };
    }
    return { intakeKind: "transcript", text: await parseTranscriptFile(file) };
  }

  if (isNotesImageFile(file)) {
    return { intakeKind: "notes", text: await extractOcrTextFromFile(file) };
  }

  if (file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf") {
    throw new Error(
      "PDF notes are not supported here yet. Photograph handwritten notes or paste text into the chat."
    );
  }

  throw new Error(
    "Unsupported notes file. Upload a photo of handwritten consultation notes (JPEG, PNG, WEBP, or HEIC)."
  );
}

export function intakeToolNameForKind(intakeKind: ResolvedIntakeKind): string {
  return INTAKE_TOOL_BY_KIND[intakeKind];
}

function sourceLabelForKind(intakeKind: ResolvedIntakeKind): string {
  if (intakeKind === "notes") {
    return "project notes photo";
  }
  if (intakeKind === "audio") {
    return "project recording";
  }
  return "project transcript file";
}

/** Short user-visible ack stored in chat history; intake text stays server-side. */
export function buildUploadAckUserMessage(params: {
  intakeKind: ResolvedIntakeKind;
  fileName: string;
}): string {
  return `I uploaded a ${sourceLabelForKind(params.intakeKind)} (\`${params.fileName}\`).`;
}

export function buildChatIntakeUserMessage(params: {
  intakeKind: ResolvedIntakeKind;
  fileName: string;
  text: string;
  projectId?: string | null;
}): string {
  const toolName = intakeToolNameForKind(params.intakeKind);

  const projectHint = params.projectId
    ? `\nUse consultation/project_id \`${params.projectId}\` when calling the intake tool.`
    : "\nIf no project is selected yet, ask the user to create or choose one before confirming the meeting.";

  return [
    buildUploadAckUserMessage(params),
    `Process the extracted text below with \`${toolName}\` and surface a meeting confirmation card.${projectHint}`,
    "",
    "---",
    params.text,
    "---",
  ].join("\n");
}

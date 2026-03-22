/**
 * Shared transcript file parsing utilities.
 *
 * Logic extracted from TranscriptIntakePanel so it can be re-used in the
 * "create meeting from transcript" flow without duplicating the VTT/DOCX
 * parsing code.
 *
 * Supports: .txt, .md, .vtt, .docx
 * Throws a descriptive error for unsupported or unparseable files.
 */

export const TRANSCRIPT_EXTRACTABLE_EXTENSIONS = ".txt, .md, .vtt, .docx";
export const TRANSCRIPT_ACCEPTED_EXTENSIONS = `${TRANSCRIPT_EXTRACTABLE_EXTENSIONS}, .pdf`;
/** Value for <input accept="..."> */
export const TRANSCRIPT_ACCEPTED_ATTR = ".txt,.md,.vtt,.docx,.pdf";

const ACCEPTED_TEXT_MIME: Record<string, boolean> = {
  "text/plain": true,
  "text/markdown": true,
};

const VTT_TIMESTAMP_PATTERN =
  /^\d{2}:\d{2}(?::\d{2})?\.\d{3}\s+-->\s+\d{2}:\d{2}(?::\d{2})?\.\d{3}/;

function normalizeExtractedText(text: string) {
  return text
    .replace(/\uFEFF/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtmlEntities(text: string) {
  if (typeof window === "undefined") return text;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

function stripVttMarkup(text: string) {
  return decodeHtmlEntities(
    text
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractSpeakerFromVoiceTag(text: string) {
  const match = text.match(/<v(?:\.[^ >]+)*\s+([^>]+)>/i);
  return match?.[1]?.trim() ?? null;
}

function extractSpeakerFromCueLines(lines: string[]) {
  for (const line of lines) {
    const voiceTagSpeaker = extractSpeakerFromVoiceTag(line);
    if (voiceTagSpeaker) return voiceTagSpeaker;

    const prefixedSpeaker = line.match(/^([A-Z][\w .'-]{1,80}):\s+/);
    if (prefixedSpeaker) return prefixedSpeaker[1].trim();
  }
  return null;
}

function formatCueLines(lines: string[], speaker: string | null) {
  const cleanedLines = lines
    .map((line) => {
      const withoutSpeakerPrefix = speaker
        ? line.replace(
            new RegExp(`^${speaker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s+`),
            ""
          )
        : line;
      return stripVttMarkup(withoutSpeakerPrefix);
    })
    .filter(Boolean);

  if (cleanedLines.length === 0) return null;

  return speaker
    ? `[${speaker}]\n${cleanedLines.join("\n")}`
    : cleanedLines.join("\n");
}

export function extractTranscriptFromVtt(content: string) {
  const blocks = normalizeExtractedText(content).split(/\n{2,}/);
  const cues: { speaker: string | null; text: string }[] = [];

  for (const block of blocks) {
    const rawLines = block
      .split("\n")
      .map((line) => line.trimEnd())
      .filter(Boolean);

    if (rawLines.length === 0) continue;
    if (/^(WEBVTT|STYLE|REGION|NOTE)\b/i.test(rawLines[0].trim())) continue;

    const cueLines = [...rawLines];

    if (
      cueLines[0] &&
      !VTT_TIMESTAMP_PATTERN.test(cueLines[0].trim()) &&
      VTT_TIMESTAMP_PATTERN.test(cueLines[1]?.trim() ?? "")
    ) {
      cueLines.shift();
    }

    if (!VTT_TIMESTAMP_PATTERN.test(cueLines[0]?.trim() ?? "")) continue;

    cueLines.shift();

    const speaker = extractSpeakerFromCueLines(cueLines);
    const formattedCue = formatCueLines(cueLines, speaker);

    if (!formattedCue) continue;

    const previousCue = cues[cues.length - 1];
    if (speaker && previousCue && previousCue.speaker === speaker) {
      previousCue.text = `${previousCue.text}\n${formattedCue.replace(/^\[[^\]]+\]\n/, "")}`;
    } else {
      cues.push({ speaker, text: formattedCue });
    }
  }

  return normalizeExtractedText(cues.map((cue) => cue.text).join("\n\n"));
}

interface MammothLike {
  extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
}

async function extractTranscriptFromDocx(file: File): Promise<string> {
  const mammoth: MammothLike = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return normalizeExtractedText(value);
}

/**
 * Parse a transcript file into plain text.
 * Throws with a user-readable message for unsupported/unreadable files.
 */
export async function parseTranscriptFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const isTextMime = !!ACCEPTED_TEXT_MIME[file.type];
  const isPlainTextExt = name.endsWith(".txt") || name.endsWith(".md");

  let extractedText: string;

  if (name.endsWith(".vtt")) {
    extractedText = extractTranscriptFromVtt(await file.text());
  } else if (isTextMime || isPlainTextExt) {
    extractedText = normalizeExtractedText(await file.text());
  } else if (name.endsWith(".docx")) {
    extractedText = await extractTranscriptFromDocx(file);
  } else if (name.endsWith(".pdf")) {
    throw new Error(
      "PDF extraction is not available yet. Copy the text from the PDF and paste it instead."
    );
  } else {
    throw new Error(
      `Unsupported file type. Please upload ${TRANSCRIPT_EXTRACTABLE_EXTENSIONS}.`
    );
  }

  if (!extractedText) {
    throw new Error(
      "No readable text was found in that file. Open it to confirm the content or paste the text manually."
    );
  }

  return extractedText;
}

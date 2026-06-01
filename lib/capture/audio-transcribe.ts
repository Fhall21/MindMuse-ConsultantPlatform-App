import { CAPTURE_AUDIO_MIME_TYPES } from "./constants";

const AUDIO_EXTENSIONS = /\.(mp3|m4a|mp4|wav|webm|ogg|flac)$/i;

export function isAudioFile(file: File): boolean {
  if (
    CAPTURE_AUDIO_MIME_TYPES.includes(
      file.type as (typeof CAPTURE_AUDIO_MIME_TYPES)[number]
    )
  ) {
    return true;
  }

  // Browsers often omit MIME on audio picks; match meeting capture extensions.
  return AUDIO_EXTENSIONS.test(file.name);
}

/** Transcribe audio via the same authenticated API route used by meeting capture. */
export async function transcribeAudioFile(file: File): Promise<string> {
  if (!isAudioFile(file)) {
    throw new Error(
      "Unsupported audio type. Upload MP3, MP4, WAV, WEBM, OGG, FLAC, or M4A."
    );
  }

  const formData = new FormData();
  formData.append("audio_file", file, file.name);

  const response = await fetch("/api/transcribe/audio", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { detail?: string };
    const detail = body.detail ?? `Transcription request failed (${response.status})`;
    if (detail.includes("not yet implemented")) {
      throw new Error(
        "Audio transcription is not available yet. Paste the transcript manually instead."
      );
    }
    throw new Error(detail);
  }

  const result = (await response.json()) as { transcript?: string };
  const text = result.transcript?.trim() ?? "";
  if (!text) {
    throw new Error(
      "No transcript text was returned. Paste the transcript manually or try another recording."
    );
  }

  return text;
}

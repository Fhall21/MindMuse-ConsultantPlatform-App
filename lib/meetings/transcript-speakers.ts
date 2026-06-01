const SPEAKER_PREFIX_PATTERN = /^([A-Z][\w .'-]{1,80}):\s+/;

/** Extract unique speaker labels from "Name: dialogue" transcript lines. */
export function extractSpeakerNamesFromTranscript(text: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(SPEAKER_PREFIX_PATTERN);
    if (!match) {
      continue;
    }

    const name = match[1].trim();
    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    names.push(name);
  }

  return names;
}

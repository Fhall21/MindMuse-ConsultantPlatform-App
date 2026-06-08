const SPEAKER_PREFIX_PATTERN = /^([^:\n]{1,120}):[ \t]+/;

export type QuoteContextMode = "compact" | "expanded";

export interface TranscriptTurn {
  start: number;
  end: number;
  speaker: string;
}

export interface QuoteContext {
  contextBefore: string | null;
  contextAfter: string | null;
}

function trimContext(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function splitWords(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length === 0 ? [] : normalized.split(" ");
}

function takeWords(text: string, maxWords: number, from: "start" | "end"): string {
  const words = splitWords(text);
  if (words.length <= maxWords) {
    return words.join(" ");
  }

  return from === "start"
    ? words.slice(0, maxWords).join(" ")
    : words.slice(words.length - maxWords).join(" ");
}

function parseTranscriptTurns(transcript: string): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  let currentTurn: TranscriptTurn | null = null;
  let lineStart = 0;

  while (lineStart <= transcript.length) {
    const lineEnd = transcript.indexOf("\n", lineStart);
    const resolvedLineEnd = lineEnd === -1 ? transcript.length : lineEnd;
    const line = transcript.slice(lineStart, resolvedLineEnd);
    const match = line.match(SPEAKER_PREFIX_PATTERN);

    if (match) {
      if (currentTurn) {
        currentTurn.end = lineStart;
      }

      currentTurn = {
        start: lineStart,
        end: transcript.length,
        speaker: match[1].trim(),
      };
      turns.push(currentTurn);
    }

    if (lineEnd === -1) {
      break;
    }

    lineStart = lineEnd + 1;
  }

  return turns;
}

function findTurnForPosition(
  turns: TranscriptTurn[],
  position: number
): TranscriptTurn | null {
  for (const turn of turns) {
    if (position >= turn.start && position < turn.end) {
      return turn;
    }
  }

  for (let index = turns.length - 1; index >= 0; index -= 1) {
    if (position >= turns[index].start) {
      return turns[index];
    }
  }

  return null;
}

function getTurnRange(
  turns: TranscriptTurn[],
  spanStart: number,
  spanEnd: number
): { startTurn: TranscriptTurn | null; endTurn: TranscriptTurn | null } {
  const startTurn = findTurnForPosition(turns, spanStart);
  const endTurn = findTurnForPosition(turns, Math.max(spanEnd - 1, spanStart));
  return { startTurn, endTurn: endTurn ?? startTurn };
}

function limitExpandedContext(before: string, after: string): QuoteContext {
  const beforeWords = splitWords(before);
  const afterWords = splitWords(after);
  const totalWords = beforeWords.length + afterWords.length;

  if (totalWords <= 120) {
    return {
      contextBefore: trimContext(beforeWords.join(" ")),
      contextAfter: trimContext(afterWords.join(" ")),
    };
  }

  if (beforeWords.length === 0) {
    return {
      contextBefore: null,
      contextAfter: trimContext(afterWords.slice(0, 120).join(" ")),
    };
  }

  if (afterWords.length === 0) {
    return {
      contextBefore: trimContext(
        beforeWords.slice(Math.max(0, beforeWords.length - 120)).join(" ")
      ),
      contextAfter: null,
    };
  }

  const beforeBudget = Math.max(
    1,
    Math.min(beforeWords.length, Math.round((beforeWords.length / totalWords) * 120))
  );
  const afterBudget = Math.max(1, Math.min(afterWords.length, 120 - beforeBudget));

  return {
    contextBefore: trimContext(beforeWords.slice(0, beforeBudget).join(" ")),
    contextAfter: trimContext(afterWords.slice(0, afterBudget).join(" ")),
  };
}

function findTurnIndex(turns: TranscriptTurn[], turn: TranscriptTurn): number {
  return turns.findIndex(
    (candidate) =>
      candidate.start === turn.start &&
      candidate.end === turn.end &&
      candidate.speaker === turn.speaker
  );
}

function findParagraphStart(
  transcript: string,
  turnStart: number,
  spanStart: number
): number {
  const boundary = transcript.lastIndexOf("\n\n", spanStart);
  return boundary >= turnStart ? boundary + 2 : turnStart;
}

function findParagraphEnd(
  transcript: string,
  spanEnd: number,
  turnEnd: number
): number {
  const boundary = transcript.indexOf("\n\n", spanEnd);
  return boundary >= 0 && boundary < turnEnd ? boundary : turnEnd;
}

function looksLikePrompt(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  return (
    normalized.includes("?") ||
    /^(interviewer|facilitator|moderator|researcher)\b/i.test(normalized)
  );
}

function buildExpandedContext(
  transcript: string,
  turns: TranscriptTurn[],
  startTurn: TranscriptTurn,
  endTurn: TranscriptTurn,
  spanStart: number,
  spanEnd: number
): QuoteContext {
  const paragraphStart = findParagraphStart(transcript, startTurn.start, spanStart);
  const paragraphEnd = findParagraphEnd(transcript, spanEnd, endTurn.end);
  const beforeParts: string[] = [];
  const startTurnIndex = findTurnIndex(turns, startTurn);
  const previousTurn = startTurnIndex > 0 ? turns[startTurnIndex - 1] : null;

  if (previousTurn) {
    const previousText = transcript.slice(previousTurn.start, previousTurn.end);
    if (looksLikePrompt(previousText)) {
      beforeParts.push(previousText);
    }
  }

  beforeParts.push(transcript.slice(paragraphStart, spanStart));

  return limitExpandedContext(
    beforeParts.join("\n\n"),
    transcript.slice(spanEnd, paragraphEnd)
  );
}

export function extractTranscriptTurns(transcript: string): TranscriptTurn[] {
  return parseTranscriptTurns(transcript);
}

export const findTurnSpans = extractTranscriptTurns;

export function computeQuoteContext(
  transcript: string,
  spanStart: number,
  spanEnd: number,
  mode: QuoteContextMode = "compact"
): QuoteContext {
  if (!transcript || spanStart < 0 || spanEnd <= spanStart) {
    return { contextBefore: null, contextAfter: null };
  }

  const turns = parseTranscriptTurns(transcript);
  if (turns.length === 0) {
    const wordLimit = mode === "expanded" ? 120 : 40;
    const charWindow = mode === "expanded" ? 720 : 240;

    return {
      contextBefore: trimContext(
        takeWords(
          transcript.slice(Math.max(0, spanStart - charWindow), spanStart),
          wordLimit,
          "start"
        )
      ),
      contextAfter: trimContext(
        takeWords(
          transcript.slice(spanEnd, Math.min(transcript.length, spanEnd + charWindow)),
          wordLimit,
          "start"
        )
      ),
    };
  }

  const { startTurn, endTurn } = getTurnRange(turns, spanStart, spanEnd);
  if (!startTurn || !endTurn) {
    return { contextBefore: null, contextAfter: null };
  }

  if (mode === "compact") {
    const beforeSource = transcript.slice(startTurn.start, spanStart);
    const afterSource = transcript.slice(spanEnd, endTurn.end);

    return {
      contextBefore: trimContext(takeWords(beforeSource, 40, "start")),
      contextAfter: trimContext(takeWords(afterSource, 40, "start")),
    };
  }

  return buildExpandedContext(
    transcript,
    turns,
    startTurn,
    endTurn,
    spanStart,
    spanEnd
  );
}

import { describe, expect, it } from "vitest";
import {
  computeQuoteContext,
  extractTranscriptTurns,
  findTurnSpans,
} from "@/lib/quotes/transcript-context";

function wordCount(text: string | null): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const TRANSCRIPT = [
  "Interviewer: What made returning difficult?",
  "Alex: The rotating shifts make my sleep unpredictable and recovery slow.",
  "Jordan: We can discuss scheduling options next week.",
  "Alex: A fixed start time would help most.",
].join("\n");

describe("transcript-context", () => {
  it("extracts speaker turns", () => {
    const turns = extractTranscriptTurns(TRANSCRIPT);
    expect(turns.map((turn) => turn.speaker)).toEqual([
      "Interviewer",
      "Alex",
      "Jordan",
      "Alex",
    ]);
  });

  it("detects multi-line turns without a new speaker prefix", () => {
    const transcript = [
      "Alice: We should keep this turn intact.",
      "It can continue across lines without a new prefix.",
      "Bob: A new turn starts here.",
    ].join("\n");

    const turns = extractTranscriptTurns(transcript);
    expect(turns).toHaveLength(2);
    expect(transcript.slice(turns[0].start, turns[0].end)).toContain(
      "continue across lines"
    );
  });

  it("keeps compact context inside the active turn", () => {
    const spanStart = TRANSCRIPT.indexOf("rotating shifts");
    const spanEnd = spanStart + "rotating shifts".length;
    const context = computeQuoteContext(TRANSCRIPT, spanStart, spanEnd, "compact");

    expect(context.contextBefore).toContain("Alex:");
    expect(context.contextAfter).not.toContain("Jordan:");
    expect(wordCount(context.contextBefore)).toBeLessThanOrEqual(40);
    expect(wordCount(context.contextAfter)).toBeLessThanOrEqual(40);
  });

  it("returns expanded context without crossing speakers", () => {
    const spanStart = TRANSCRIPT.indexOf("fixed start time");
    const spanEnd = spanStart + "fixed start time".length;
    const context = computeQuoteContext(TRANSCRIPT, spanStart, spanEnd, "expanded");

    expect(context.contextBefore).toContain("Alex:");
    expect(context.contextAfter).not.toContain("Jordan:");
    expect(
      wordCount(context.contextBefore) + wordCount(context.contextAfter)
    ).toBeLessThanOrEqual(120);
  });

  it("computes compact quote context within long turns", () => {
    const before = Array.from({ length: 70 }, (_, index) => `before${index + 1}`).join(
      " "
    );
    const after = Array.from({ length: 70 }, (_, index) => `after${index + 1}`).join(
      " "
    );
    const transcript = `Alice: ${before} QUOTE ${after}\nBob: different speaker should not bleed in.`;
    const spanStart = transcript.indexOf("QUOTE");
    const spanEnd = spanStart + "QUOTE".length;
    const context = computeQuoteContext(transcript, spanStart, spanEnd, "compact");

    expect(context.contextBefore).toContain("Alice:");
    expect(context.contextAfter).not.toContain("Bob:");
  });
});

describe("findTurnSpans", () => {
  it("detects speaker turns with character offsets", () => {
    const turns = findTurnSpans(TRANSCRIPT);

    expect(turns).toHaveLength(4);
    expect(turns[1]).toMatchObject({
      speaker: "Alex",
      start: TRANSCRIPT.indexOf("Alex: The rotating"),
    });
    expect(turns[1]?.end).toBe(TRANSCRIPT.indexOf("Jordan:"));
  });
});

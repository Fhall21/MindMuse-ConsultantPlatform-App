import { describe, expect, it } from "vitest";
import {
  buildQuoteReviewOutput,
  formatTranscriptPosition,
  normalizeIdentifiedQuotes,
  readQuoteReviewOutput,
} from "@/lib/chat/tools/quotes";

describe("lib/chat/tools/quotes", () => {
  it("normalizes FastAPI quote identify payloads", () => {
    const quotes = normalizeIdentifiedQuotes({
      quotes: [
        {
          text: "We need more recovery time between shifts.",
          speaker: "Alex",
          theme_id: "22222222-2222-4222-8222-222222222222",
          span_start: 10,
          span_end: 52,
        },
        { text: "", theme_id: "22222222-2222-4222-8222-222222222222" },
      ],
    });

    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.speaker).toBe("Alex");
  });

  it("builds and reads quote review output with decisions", () => {
    const output = buildQuoteReviewOutput({
      meetingId: "11111111-1111-4111-8111-111111111111",
      quotes: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          text: "Quote text",
          theme_id: "22222222-2222-4222-8222-222222222222",
          theme_label: "Workload",
          span_start: 0,
          span_end: 10,
        },
      ],
      decisions: {
        "33333333-3333-4333-8333-333333333333": "accepted",
      },
      dbQuoteIds: {
        "33333333-3333-4333-8333-333333333333": "44444444-4444-4444-8444-444444444444",
      },
    });

    const parsed = readQuoteReviewOutput(output);
    expect(parsed?.meeting_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(parsed?.decisions["33333333-3333-4333-8333-333333333333"]).toBe("accepted");
    expect(parsed?.db_quote_ids["33333333-3333-4333-8333-333333333333"]).toBe(
      "44444444-4444-4444-8444-444444444444"
    );
  });

  it("formats transcript positions for display", () => {
    expect(formatTranscriptPosition(120, 240)).toBe("chars 120–240");
  });
});

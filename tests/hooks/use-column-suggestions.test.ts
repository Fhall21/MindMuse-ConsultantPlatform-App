import { describe, expect, it } from "vitest";
import {
  dedupeColumnSuggestions,
  normalizeColumnSuggestions,
} from "@/hooks/use-column-suggestions";

describe("normalizeColumnSuggestions", () => {
  it("maps API string[] to ColumnSuggestion objects", () => {
    expect(
      normalizeColumnSuggestions([
        "What barriers emerged?",
        "What support is missing?",
      ])
    ).toEqual([
      { question: "What barriers emerged?", rationale: null },
      { question: "What support is missing?", rationale: null },
    ]);
  });

  it("removes empty, duplicate, and invalid entries", () => {
    expect(
      normalizeColumnSuggestions([
        "What barriers emerged?",
        "What barriers emerged?",
        "   ",
        null,
        { question: "What support is missing?", rationale: "from object" },
        { question: "   ", rationale: null },
      ])
    ).toEqual([
      { question: "What barriers emerged?", rationale: null },
      { question: "What support is missing?", rationale: "from object" },
    ]);
  });

  it("returns empty array for non-array input", () => {
    expect(normalizeColumnSuggestions(undefined)).toEqual([]);
    expect(normalizeColumnSuggestions({ suggestions: [] })).toEqual([]);
  });
});

describe("dedupeColumnSuggestions", () => {
  it("delegates to normalizeColumnSuggestions for object input", () => {
    const result = dedupeColumnSuggestions([
      { question: "What barriers emerged?", rationale: null },
      { question: "What barriers emerged?", rationale: "dup" },
      { question: "   ", rationale: null },
      { question: "What support is missing?", rationale: null },
    ]);

    expect(result).toEqual([
      { question: "What barriers emerged?", rationale: null },
      { question: "What support is missing?", rationale: null },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  computeCellConfidence,
  computeInsightConfidence,
  evidenceConfidenceClassName,
  formatEvidenceConfidence,
  scoreToConfidence,
} from "@/lib/quotes/insight-confidence";

describe("insight-confidence", () => {
  it("scores stronger quote sets higher", () => {
    expect(
      computeInsightConfidence([
        { relevanceStrength: "strong_match" },
        { relevanceStrength: "partial_support" },
      ])
    ).toBe("high");
    expect(computeInsightConfidence([{ relevanceStrength: "weak" }])).toBe("low");
    expect(computeInsightConfidence([])).toBeNull();
  });

  it("selects the strongest cell confidence", () => {
    expect(computeCellConfidence([null, "low", "medium", undefined], "low")).toBe(
      "medium"
    );
    expect(computeCellConfidence([null, undefined], "high")).toBe("high");
  });

  it("formats evidence labels and classes", () => {
    expect(scoreToConfidence(0.8)).toBe("high");
    expect(formatEvidenceConfidence("medium")).toBe("Medium evidence");
    expect(evidenceConfidenceClassName("low")).toContain("underline");
  });
});
import { describe, expect, it } from "vitest";
import {
  computeCellConfidence,
  computeInsightConfidence,
} from "@/lib/quotes/insight-confidence";

describe("insight-confidence", () => {
  it("returns null when there are no quote links", () => {
    expect(computeInsightConfidence([])).toBeNull();
  });

  it("maps quote relevance strengths onto the configured confidence thresholds", () => {
    expect(
      computeInsightConfidence([{ relevanceStrength: "strong_match" }, { relevanceStrength: "strong_match" }])
    ).toBe("high");
    expect(computeInsightConfidence([{ relevanceStrength: "partial_support" }])).toBe("medium");
    expect(computeInsightConfidence([{ relevanceStrength: "weak" }])).toBe("low");
    expect(computeInsightConfidence([{ relevanceStrength: null }])).toBe("low");
  });

  it("selects the strongest non-null cell confidence", () => {
    expect(computeCellConfidence([null, "low", "medium", undefined])).toBe("medium");
    expect(computeCellConfidence(["low", "high", "medium"])).toBe("high");
    expect(computeCellConfidence([null, undefined])).toBeNull();
  });
});
import { describe, expect, it } from "vitest";
import {
  computeCellConfidence,
  computeInsightConfidence,
  formatEvidenceConfidence,
  scoreToConfidence,
} from "@/lib/quotes/insight-confidence";

describe("computeInsightConfidence", () => {
  it("scores strong quotes as high confidence", () => {
    const confidence = computeInsightConfidence([
      { relevanceStrength: "strong_match" },
      { relevanceStrength: "partial_support" },
    ]);

    expect(confidence).toBe("high");
  });

  it("returns low confidence for weak-only quotes", () => {
    const confidence = computeInsightConfidence([
      { relevanceStrength: "weak" },
      { relevanceStrength: "context" },
    ]);

    expect(confidence).toBe("low");
  });

  it("returns null when no quotes exist", () => {
    expect(computeInsightConfidence([])).toBeNull();
  });
});

describe("computeCellConfidence", () => {
  it("uses the strongest insight confidence", () => {
    expect(
      computeCellConfidence(["low", "medium", "high"], "low")
    ).toBe("high");
  });

  it("falls back to AI confidence when insights have no quotes", () => {
    expect(computeCellConfidence([null, null], "medium")).toBe("medium");
  });
});

describe("scoreToConfidence", () => {
  it("maps thresholds to labels", () => {
    expect(scoreToConfidence(0.8)).toBe("high");
    expect(scoreToConfidence(0.5)).toBe("medium");
    expect(scoreToConfidence(0.2)).toBe("low");
    expect(formatEvidenceConfidence("high")).toBe("High evidence");
  });
});

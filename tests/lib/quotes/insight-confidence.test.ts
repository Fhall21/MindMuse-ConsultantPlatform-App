import { describe, expect, it } from "vitest";
import {
  computeCellConfidence,
  computeInsightConfidence,
  evidenceConfidenceClassName,
  formatEvidenceConfidence,
  scoreToConfidence,
} from "@/lib/quotes/insight-confidence";

describe("insight-confidence", () => {
  describe("computeInsightConfidence", () => {
    it("scores stronger quote sets higher", () => {
      expect(
        computeInsightConfidence([
          { relevanceStrength: "strong_match" },
          { relevanceStrength: "partial_support" },
        ])
      ).toBe("high");
      expect(
        computeInsightConfidence([
          { relevanceStrength: "strong_match" },
          { relevanceStrength: "strong_match" },
        ])
      ).toBe("high");
      expect(
        computeInsightConfidence([{ relevanceStrength: "partial_support" }])
      ).toBe("medium");
      expect(
        computeInsightConfidence([{ relevanceStrength: "weak" }])
      ).toBe("low");
      expect(
        computeInsightConfidence([
          { relevanceStrength: "weak" },
          { relevanceStrength: "context" },
        ])
      ).toBe("low");
      expect(
        computeInsightConfidence([{ relevanceStrength: null }])
      ).toBe("low");
    });

    it("returns null when no quotes exist", () => {
      expect(computeInsightConfidence([])).toBeNull();
    });
  });

  describe("computeCellConfidence", () => {
    it("selects the strongest non-null cell confidence", () => {
      expect(
        computeCellConfidence([null, "low", "medium", undefined], "low")
      ).toBe("medium");
      expect(computeCellConfidence([null, undefined], "high")).toBe("high");
      expect(
        computeCellConfidence([null, "low", "medium", undefined])
      ).toBe("medium");
      expect(computeCellConfidence(["low", "high", "medium"])).toBe("high");
      expect(computeCellConfidence([null, undefined])).toBeNull();
      expect(
        computeCellConfidence(["low", "medium", "high"], "low")
      ).toBe("high");
    });

    it("falls back to AI confidence when insights have no quotes", () => {
      expect(computeCellConfidence([null, null], "medium")).toBe("medium");
    });
  });

  describe("scoreToConfidence and formatting", () => {
    it("maps score thresholds to labels", () => {
      expect(scoreToConfidence(0.8)).toBe("high");
      expect(scoreToConfidence(0.5)).toBe("medium");
      expect(scoreToConfidence(0.2)).toBe("low");
    });

    it("formats evidence confidence labels", () => {
      expect(formatEvidenceConfidence("medium")).toBe("Medium evidence");
      expect(formatEvidenceConfidence("high")).toBe("High evidence");
    });

    it("returns appropriate classnames", () => {
      expect(evidenceConfidenceClassName("low")).toContain("underline");
    });
  });
});

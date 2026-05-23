import { describe, expect, it } from "vitest";
import {
  artifactReferencedInText,
  figureReferencedInText,
  normalizeForMatch,
} from "@/components/research/analysis-artifact-preview";
import type { AnalysisArtifact } from "@/hooks/use-research";

const sampleArtifact: AnalysisArtifact = {
  entry_id: "psychosocial-hazard-summary-last6mo-csv-ujjq",
  filename: "psychosocial-hazard-summary-last6mo.csv",
  mime_type: "text/csv",
};

describe("analysis artifact reference matching", () => {
  it("normalizes hyphen and underscore forms", () => {
    expect(normalizeForMatch("foo-bar_baz")).toBe("foo bar baz");
  });

  it("matches entry_id and filename mentions in summary text", () => {
    const text =
      "See psychosocial-hazard-summary-last6mo.csv for the full hazard breakdown.";
    expect(artifactReferencedInText(sampleArtifact, text)).toBe(true);
  });

  it("matches basename without extension", () => {
    const text = "The psychosocial hazard summary last6mo table lists top risks.";
    expect(artifactReferencedInText(sampleArtifact, text)).toBe(true);
  });

  it("matches figure alt text", () => {
    expect(
      figureReferencedInText(
        { alt: "Department hazard heatmap" },
        "Refer to the department hazard heatmap for clustering."
      )
    ).toBe(true);
  });
});

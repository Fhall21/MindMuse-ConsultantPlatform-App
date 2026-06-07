import type { CellConfidence, RelevanceStrength } from "@/types/grid";

const RELEVANCE_WEIGHTS: Record<RelevanceStrength | "null", number> = {
  strong_match: 1.0,
  partial_support: 0.65,
  context: 0.35,
  weak: 0.15,
  null: 0.2,
};

const CONFIDENCE_ORDER: Record<CellConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function relevanceWeight(
  strength: RelevanceStrength | null | undefined
): number {
  return RELEVANCE_WEIGHTS[strength ?? "null"];
}

export function scoreToConfidence(score: number): CellConfidence {
  if (score >= 0.72) return "high";
  if (score >= 0.42) return "medium";
  return "low";
}

export function computeInsightConfidence(
  quotes: Array<{ relevanceStrength: RelevanceStrength | null | undefined }>
): CellConfidence | null {
  if (quotes.length === 0) {
    return null;
  }

  const sortedWeights = quotes
    .map((quote) => relevanceWeight(quote.relevanceStrength))
    .sort((left, right) => right - left);
  const topWeights = sortedWeights.slice(0, 2);
  const base =
    topWeights.reduce((sum, weight) => sum + weight, 0) / topWeights.length;
  const bonus = Math.min(0.15, 0.05 * (quotes.length - 1));

  return scoreToConfidence(Math.min(1, base + bonus));
}

export function computeCellConfidence(
  insightConfidences: Array<CellConfidence | null | undefined>,
  fallback: CellConfidence | null = null
): CellConfidence | null {
  const resolved = insightConfidences.filter(
    (confidence): confidence is CellConfidence => confidence != null
  );

  if (resolved.length === 0) {
    return fallback;
  }

  return resolved.reduce((best, current) =>
    CONFIDENCE_ORDER[current] > CONFIDENCE_ORDER[best] ? current : best
  );
}

export function formatEvidenceConfidence(confidence: CellConfidence): string {
  switch (confidence) {
    case "high":
      return "High evidence";
    case "medium":
      return "Medium evidence";
    case "low":
      return "Low evidence";
  }
}

export function evidenceConfidenceClassName(confidence: CellConfidence): string {
  switch (confidence) {
    case "high":
      return "text-emerald-700 underline decoration-emerald-300/80 underline-offset-2 dark:text-emerald-300";
    case "medium":
      return "text-amber-800 underline decoration-amber-300/80 underline-offset-2 dark:text-amber-300";
    case "low":
      return "text-muted-foreground underline decoration-border underline-offset-2";
  }
}

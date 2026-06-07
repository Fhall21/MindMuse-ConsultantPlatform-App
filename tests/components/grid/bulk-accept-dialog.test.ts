import { describe, expect, it } from "vitest";
import { getEligibleBulkAcceptTargets } from "@/components/grid/bulk-accept-dialog";
import type { InsightWithLinks } from "@/types/grid";

function insight(
  id: string,
  gridCellId: string,
  gridReviewState: InsightWithLinks["gridReviewState"]
): InsightWithLinks {
  return {
    id,
    gridCellId,
    gridReviewState,
    label: id,
    description: null,
    junctionId: `junction-${id}-${gridCellId}`,
    editedLabel: null,
    accepted: gridReviewState === "accepted",
    rejected: gridReviewState === "rejected",
    gridColumnId: "column-1",
    connectedColumns: [],
    quotes: [],
    quoteConfidence: null,
  };
}

describe("getEligibleBulkAcceptTargets", () => {
  it("includes only pending insights in complete cells", () => {
    const result = getEligibleBulkAcceptTargets(
      [
        insight("pending-complete", "cell-complete", "pending"),
        insight("rejected-complete", "cell-complete", "rejected"),
        insight("accepted-complete", "cell-complete", "accepted"),
        insight("pending-generating", "cell-generating", "pending"),
      ],
      new Set(["cell-complete"])
    );

    expect(result).toEqual([
      { id: "pending-complete", gridCellId: "cell-complete" },
    ]);
  });

  it("keeps separate junction targets when one insight appears in two cells", () => {
    const result = getEligibleBulkAcceptTargets(
      [
        insight("shared", "cell-1", "pending"),
        insight("shared", "cell-2", "pending"),
      ],
      new Set(["cell-1", "cell-2"])
    );

    expect(result).toHaveLength(2);
  });
});

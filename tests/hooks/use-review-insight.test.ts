import { describe, expect, it } from "vitest";
import { applyReviewState } from "@/hooks/use-review-insight";
import type { InsightWithLinks } from "@/types/grid";

function insight(id: string): InsightWithLinks {
  return {
    id,
    label: id,
    description: null,
    junctionId: `junction-${id}`,
    editedLabel: null,
    gridReviewState: "pending",
    accepted: false,
    rejected: false,
    gridCellId: "cell-1",
    gridColumnId: "column-1",
    connectedColumns: [],
    quotes: [],
    quoteConfidence: null,
  };
}

describe("applyReviewState", () => {
  it("updates review state without moving insight", () => {
    const current = [insight("first"), insight("second"), insight("third")];

    const updated = applyReviewState(current, "second", "accepted");

    expect(updated.map((item) => item.id)).toEqual([
      "first",
      "second",
      "third",
    ]);
    expect(updated[1]).toMatchObject({
      gridReviewState: "accepted",
      accepted: true,
      rejected: false,
    });
  });
});

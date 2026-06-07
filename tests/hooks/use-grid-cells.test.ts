import { describe, it, expect } from "vitest";
import { getRefetchInterval } from "@/hooks/use-grid-cells";

describe("getRefetchInterval", () => {
  it("returns 2000 when any cell is generating", () => {
    const result = getRefetchInterval({
      cells: [{ status: "complete" }, { status: "generating" }],
    });
    expect(result).toBe(2000);
  });

  it("returns false when all cells are complete/no_evidence/failed", () => {
    const result = getRefetchInterval({
      cells: [
        { status: "complete" },
        { status: "no_evidence" },
        { status: "failed" },
      ],
    });
    expect(result).toBe(false);
  });

  it("returns false when cells array is empty", () => {
    expect(getRefetchInterval({ cells: [] })).toBe(false);
    expect(getRefetchInterval(undefined)).toBe(false);
  });
});

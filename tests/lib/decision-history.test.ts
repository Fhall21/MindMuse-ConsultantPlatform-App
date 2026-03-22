import { describe, expect, it } from "vitest";
import { resolveDecisionTargetLabel } from "@/lib/decision-history";

describe("lib/decision-history", () => {
  it("uses the live group label when the target id matches a theme group", () => {
    const label = resolveDecisionTargetLabel(
      {
        target_type: "theme_group",
        target_id: "group-1",
        metadata: { original_label: "Analytics Label" },
      },
      new Map([["group-1", "Human Label"]]),
      new Map()
    );

    expect(label).toBe("Human Label");
  });

  it("falls back to analytics metadata labels when the target id is not a real theme group", () => {
    const label = resolveDecisionTargetLabel(
      {
        target_type: "theme_group",
        target_id: "cluster-row-1",
        metadata: { original_label: "Workload cluster" },
      },
      new Map(),
      new Map()
    );

    expect(label).toBe("Workload cluster");
  });

  it("prefers edited analytics labels over original labels", () => {
    const label = resolveDecisionTargetLabel(
      {
        target_type: "theme_group",
        target_id: "cluster-row-1",
        metadata: {
          original_label: "Workload cluster",
          edited_label: "Operational pressure",
        },
      },
      new Map(),
      new Map()
    );

    expect(label).toBe("Operational pressure");
  });
});
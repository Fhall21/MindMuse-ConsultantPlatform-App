import { describe, expect, it } from "vitest";
import {
  getDraggedInsightIds,
  resolveCanvasGroupingPlan,
} from "@/lib/canvas-interactions";
import type { CanvasNode } from "@/types/canvas";

function makeInsight(id: string, overrides: Partial<CanvasNode> = {}): CanvasNode {
  return {
    id,
    type: "insight",
    label: `Insight ${id}`,
    description: null,
    accepted: true,
    subgroup: null,
    sourceConsultationId: "consultation-1",
    sourceConsultationTitle: "Consultation 1",
    groupId: null,
    memberIds: [],
    isUserAdded: false,
    lockedFromSource: false,
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

function makeGroup(id: string, memberIds: string[] = []): CanvasNode {
  return {
    id,
    type: "theme",
    label: `Group ${id}`,
    description: null,
    accepted: false,
    subgroup: null,
    sourceConsultationId: null,
    sourceConsultationTitle: null,
    groupId: null,
    memberIds,
    isUserAdded: false,
    lockedFromSource: false,
    position: { x: 320, y: 120 },
  };
}

describe("lib/canvas-interactions", () => {
  it("creates a group when one ungrouped insight is dropped onto another", () => {
    const nodes = [makeInsight("insight-a"), makeInsight("insight-b")];

    expect(
      resolveCanvasGroupingPlan({
        activeNodeId: "insight-a",
        targetNodeId: "insight-b",
        selectedNodeIds: [],
        nodes,
      })
    ).toEqual({
      type: "create-group",
      seedInsightIds: ["insight-a", "insight-b"],
    });
  });

  it("moves the full selected set when a selected insight is dragged onto a group", () => {
    const nodes = [
      makeInsight("insight-a"),
      makeInsight("insight-b"),
      makeGroup("group-1"),
    ];

    expect(
      resolveCanvasGroupingPlan({
        activeNodeId: "insight-a",
        targetNodeId: "group-1",
        selectedNodeIds: ["insight-a", "insight-b"],
        nodes,
      })
    ).toEqual({
      type: "add-to-group",
      targetGroupId: "group-1",
      insightIds: ["insight-a", "insight-b"],
    });
  });

  it("adds selected insights to the target insight's existing group", () => {
    const nodes = [
      makeInsight("insight-a"),
      makeInsight("insight-b"),
      makeInsight("insight-c", { groupId: "group-1" }),
      makeGroup("group-1", ["insight-c"]),
    ];

    expect(
      resolveCanvasGroupingPlan({
        activeNodeId: "insight-a",
        targetNodeId: "insight-c",
        selectedNodeIds: ["insight-a", "insight-b"],
        nodes,
      })
    ).toEqual({
      type: "add-to-group",
      targetGroupId: "group-1",
      insightIds: ["insight-a", "insight-b"],
    });
  });

  it("keeps selection stable by treating a self-drop as a no-op", () => {
    const nodes = [makeInsight("insight-a")];

    expect(
      resolveCanvasGroupingPlan({
        activeNodeId: "insight-a",
        targetNodeId: "insight-a",
        selectedNodeIds: ["insight-a"],
        nodes,
      })
    ).toEqual({
      type: "noop",
      reason: "invalid-target",
    });
  });

  it("only drags selected insight ids, never theme group ids", () => {
    const nodes = [
      makeInsight("insight-a"),
      makeGroup("group-1"),
    ];

    expect(
      getDraggedInsightIds({
        activeNodeId: "insight-a",
        selectedNodeIds: ["insight-a", "group-1"],
        nodes,
      })
    ).toEqual(["insight-a"]);
  });
});

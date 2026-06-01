import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import { applyThemeInsightNodeChanges } from "@/lib/canvas-flow-drag";
import type { CanvasNode } from "@/types/canvas";

function flowNode(
  id: string,
  type: CanvasNode["type"],
  groupId: string | null,
  x: number,
  y: number
): Node {
  return {
    id,
    type: "canvasNode",
    position: { x, y },
    data: {
      node: {
        id,
        type,
        label: id,
        description: null,
        accepted: false,
        subgroup: null,
        sourceConsultationId: null,
        sourceConsultationTitle: null,
        groupId,
        memberIds: [],
        isUserAdded: false,
        lockedFromSource: false,
        position: { x, y },
      } satisfies CanvasNode,
      isNestedInGroup: Boolean(groupId),
      memberPreviewLabels: [],
    },
  };
}

describe("applyThemeInsightNodeChanges", () => {
  it("moves a group theme and its insight children together", () => {
    const nodes = [
      flowNode("group-a", "theme", null, 100, 200),
      flowNode("insight-a", "insight", "group-a", 128, 342),
      flowNode("insight-b", "insight", "group-a", 410, 342),
      flowNode("insight-other", "insight", null, 800, 900),
    ];

    const result = applyThemeInsightNodeChanges(
      [{ id: "group-a", type: "position", position: { x: 260, y: 380 }, dragging: true }],
      nodes
    );

    expect(result.map((node) => [node.id, node.position])).toEqual([
      ["group-a", { x: 260, y: 380 }],
      ["insight-a", { x: 288, y: 522 }],
      ["insight-b", { x: 570, y: 522 }],
      ["insight-other", { x: 800, y: 900 }],
    ]);
  });

  it("does not move siblings when an insight is dragged", () => {
    const nodes = [
      flowNode("group-a", "theme", null, 100, 200),
      flowNode("insight-a", "insight", "group-a", 128, 342),
      flowNode("insight-b", "insight", "group-a", 410, 342),
    ];

    const result = applyThemeInsightNodeChanges(
      [{ id: "insight-a", type: "position", position: { x: 500, y: 600 }, dragging: true }],
      nodes
    );

    expect(result.map((node) => [node.id, node.position])).toEqual([
      ["group-a", { x: 100, y: 200 }],
      ["insight-a", { x: 500, y: 600 }],
      ["insight-b", { x: 410, y: 342 }],
    ]);
  });
});

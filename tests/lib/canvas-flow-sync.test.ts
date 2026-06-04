import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import { syncFlowNodes } from "@/lib/canvas-flow-sync";
import type { CanvasNode } from "@/types/canvas";

function insightNode(id: string, groupId: string | null, x: number, y: number): Node {
  return {
    id,
    type: "canvasNode",
    position: { x, y },
    data: {
      node: {
        id,
        type: "insight",
        label: id,
        description: null,
        accepted: false,
        isBrainstorming: false,
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

describe("syncFlowNodes", () => {
  it("accepts the server grid position when an insight joins a group", () => {
    const current = insightNode("insight-a", null, 40, 80);
    const next = insightNode("insight-a", "group-a", 428, 262);

    const [result] = syncFlowNodes([current], [next], [], new Set());

    expect(result.position).toEqual({ x: 428, y: 262 });
    expect((result.data.node as CanvasNode).groupId).toBe("group-a");
  });

  it("preserves an optimistic drag-out through unrelated syncs while the server is stale", () => {
    const current = insightNode("insight-a", null, 720, 420);
    const staleServer = insightNode("insight-a", "group-a", 428, 262);
    const pendingDetaches = new Set(["insight-a"]);

    const [firstResult] = syncFlowNodes([current], [staleServer], ["insight-a"], pendingDetaches);
    const [secondResult] = syncFlowNodes([firstResult], [staleServer], [], pendingDetaches);

    expect(secondResult.position).toEqual({ x: 720, y: 420 });
    expect((secondResult.data.node as CanvasNode).groupId).toBeNull();
    expect(pendingDetaches.has("insight-a")).toBe(true);
  });

  it("clears a detach marker after the server confirms the insight left its group", () => {
    const current = insightNode("insight-a", null, 720, 420);
    const confirmedServer = insightNode("insight-a", null, 720, 420);
    const pendingDetaches = new Set(["insight-a"]);

    const [result] = syncFlowNodes([current], [confirmedServer], [], pendingDetaches);

    expect(result.position).toEqual({ x: 720, y: 420 });
    expect(pendingDetaches.has("insight-a")).toBe(false);
  });
});

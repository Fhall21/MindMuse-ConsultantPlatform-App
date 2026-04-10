import { describe, expect, it } from "vitest";
import {
  buildCanvasReorganiseLayout,
  GROUP_WIDTH,
  INSIGHT_HEIGHT,
  INSIGHT_WIDTH,
} from "@/lib/canvas-layout";
import type { CanvasEdge, CanvasNode } from "@/types/canvas";

function createInsightNode(
  id: string,
  position: { x: number; y: number },
  overrides: Partial<CanvasNode> = {}
): CanvasNode {
  return {
    id,
    type: "insight",
    label: id,
    description: null,
    accepted: true,
    subgroup: null,
    sourceConsultationId: null,
    sourceConsultationTitle: null,
    groupId: null,
    memberIds: [],
    isUserAdded: false,
    lockedFromSource: false,
    position,
    ...overrides,
  };
}

function createThemeNode(
  id: string,
  position: { x: number; y: number },
  memberIds: string[]
): CanvasNode {
  return {
    id,
    type: "theme",
    label: id,
    description: null,
    accepted: true,
    subgroup: null,
    sourceConsultationId: null,
    sourceConsultationTitle: null,
    groupId: null,
    memberIds,
    isUserAdded: false,
    lockedFromSource: false,
    position,
  };
}

describe("buildCanvasReorganiseLayout", () => {
  it("reorganises only the selected top-level nodes", () => {
    const nodes = [
      createInsightNode("insight-a", { x: 460, y: 300 }),
      createInsightNode("insight-b", { x: 80, y: 40 }),
      createInsightNode("insight-c", { x: 900, y: 80 }),
    ];
    const edges: CanvasEdge[] = [
      {
        id: "edge-a-b",
        source_node_id: "insight-a",
        target_node_id: "insight-b",
        connection_type: "causes",
        note: null,
        created_by: "user-1",
        created_at: "2026-04-10T00:00:00.000Z",
        updated_at: "2026-04-10T00:00:00.000Z",
      },
    ];

    const result = buildCanvasReorganiseLayout({
      nodes,
      edges,
      selectedNodeIds: ["insight-a", "insight-b"],
    });

    expect(result).not.toBeNull();
    expect(result?.scope).toBe("selected");
    expect(result?.movedNodeIds).toEqual(
      expect.arrayContaining(["insight-a", "insight-b"])
    );
    expect(result?.positions["insight-c"]).toBeUndefined();
    expect(result?.positions["insight-a"].x).toBeLessThan(result?.positions["insight-b"].x ?? 0);
  });

  it("moves grouped members with their selected theme and uses member edges for direction", () => {
    const nodes = [
      createThemeNode("theme-a", { x: 520, y: 260 }, ["insight-a"]),
      createInsightNode("insight-a", { x: 548, y: 402 }, { groupId: "theme-a" }),
      createInsightNode("insight-b", { x: 120, y: 80 }),
    ];
    const edges: CanvasEdge[] = [
      {
        id: "edge-a-b",
        source_node_id: "insight-a",
        target_node_id: "insight-b",
        connection_type: "influences",
        note: null,
        created_by: "user-1",
        created_at: "2026-04-10T00:00:00.000Z",
        updated_at: "2026-04-10T00:00:00.000Z",
      },
    ];

    const result = buildCanvasReorganiseLayout({
      nodes,
      edges,
      selectedNodeIds: ["theme-a", "insight-b"],
    });

    expect(result).not.toBeNull();
    expect(result?.positions["theme-a"].x).toBeLessThan(result?.positions["insight-b"].x ?? 0);
    expect(result?.positions["insight-a"]).toBeDefined();

    const themeDeltaX = (result?.positions["theme-a"].x ?? 0) - nodes[0].position.x;
    const themeDeltaY = (result?.positions["theme-a"].y ?? 0) - nodes[0].position.y;

    expect(result?.positions["insight-a"]).toEqual({
      x: Math.round((nodes[1].position.x + themeDeltaX) * 100) / 100,
      y: Math.round((nodes[1].position.y + themeDeltaY) * 100) / 100,
    });
  });

  it("returns null when fewer than two top-level nodes are available to reorganise", () => {
    const nodes = [
      createThemeNode("theme-a", { x: 400, y: 220 }, ["insight-a"]),
      createInsightNode("insight-a", { x: 430, y: 360 }, { groupId: "theme-a" }),
    ];

    expect(
      buildCanvasReorganiseLayout({
        nodes,
        edges: [],
        selectedNodeIds: ["insight-a"],
      })
    ).toBeNull();
  });

  it("keeps layout entities from overlapping after dagre placement", () => {
    const nodes = [
      createThemeNode("theme-a", { x: 100, y: 100 }, ["insight-a"]),
      createInsightNode("insight-a", { x: 128, y: 242 }, { groupId: "theme-a" }),
      createInsightNode("insight-b", { x: 200, y: 500 }),
      createInsightNode("insight-c", { x: 650, y: 240 }),
    ];
    const edges: CanvasEdge[] = [
      {
        id: "edge-ab",
        source_node_id: "insight-a",
        target_node_id: "insight-b",
        connection_type: "supports",
        note: null,
        created_by: "user-1",
        created_at: "2026-04-10T00:00:00.000Z",
        updated_at: "2026-04-10T00:00:00.000Z",
      },
      {
        id: "edge-bc",
        source_node_id: "insight-b",
        target_node_id: "insight-c",
        connection_type: "supports",
        note: null,
        created_by: "user-1",
        created_at: "2026-04-10T00:00:00.000Z",
        updated_at: "2026-04-10T00:00:00.000Z",
      },
    ];

    const result = buildCanvasReorganiseLayout({
      nodes,
      edges,
      selectedNodeIds: [],
    });

    expect(result).not.toBeNull();

    const themeBox = {
      left: result?.positions["theme-a"].x ?? 0,
      right: (result?.positions["theme-a"].x ?? 0) + GROUP_WIDTH,
    };
    const insightBBox = {
      left: result?.positions["insight-b"].x ?? 0,
      right: (result?.positions["insight-b"].x ?? 0) + INSIGHT_WIDTH,
      top: result?.positions["insight-b"].y ?? 0,
      bottom: (result?.positions["insight-b"].y ?? 0) + INSIGHT_HEIGHT,
    };
    const insightCBox = {
      left: result?.positions["insight-c"].x ?? 0,
      right: (result?.positions["insight-c"].x ?? 0) + INSIGHT_WIDTH,
      top: result?.positions["insight-c"].y ?? 0,
      bottom: (result?.positions["insight-c"].y ?? 0) + INSIGHT_HEIGHT,
    };

    expect(themeBox.right <= insightBBox.left || insightBBox.right <= themeBox.left).toBe(true);
    expect(
      insightBBox.right <= insightCBox.left ||
        insightCBox.right <= insightBBox.left ||
        insightBBox.bottom <= insightCBox.top ||
        insightCBox.bottom <= insightBBox.top
    ).toBe(true);
  });
});

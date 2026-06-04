import { describe, expect, it } from "vitest";
import { renderCanvasImagePayload } from "@/lib/server/canvas-svg-renderer";
import type { CanvasEdge, CanvasNode } from "@/types/canvas";

function node(id: string, x: number, y: number): CanvasNode {
  return {
    accepted: true,
    isBrainstorming: false,
    description: "Description",
    groupId: null,
    id,
    isUserAdded: false,
    label: `Node ${id}`,
    lockedFromSource: false,
    memberIds: [],
    position: { x, y },
    sourceConsultationId: null,
    sourceConsultationTitle: "Session",
    subgroup: null,
    type: "insight",
  };
}

function edge(
  id: string,
  source: string,
  target: string,
  connectionType: CanvasEdge["connection_type"]
): CanvasEdge {
  return {
    connection_type: connectionType,
    created_at: "2026-05-25T10:00:00Z",
    created_by: "user-1",
    id,
    note: null,
    source_node_id: source,
    target_node_id: target,
    updated_at: "2026-05-25T10:00:00Z",
  };
}

function decodeSvg(dataUrl: string): string {
  return Buffer.from(dataUrl.slice("data:image/svg+xml;base64,".length), "base64").toString(
    "utf-8"
  );
}

describe("renderCanvasImagePayload", () => {
  it("does not emit zero-length dash arrays for solid bezier edges", () => {
    const payload = renderCanvasImagePayload({
      edges: [
        edge("solid", "a", "b", "supports"),
        edge("dashed", "a", "b", "contradicts"),
      ],
      frames: [],
      nodes: [node("a", 0, 0), node("b", 500, 100)],
    });

    const svg = decodeSvg(payload!.full!);

    expect(svg).not.toContain('stroke-dasharray="0"');
    expect(svg).toContain('stroke-dasharray="6 4"');
  });
});

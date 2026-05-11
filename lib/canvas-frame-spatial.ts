/**
 * Spatial helpers for canvas frames (sprint 16 task 03.5).
 *
 * Frames are bounding-box rectangles in canvas flow coordinates. These helpers
 * compute frame ↔ node membership based on geometry. Membership is then
 * persisted in `frame.node_ids` so consumers (reports, snapshots) can filter
 * without re-running geometry.
 */
import type { CanvasFrame, CanvasNode, CanvasPosition } from "@/types/canvas";

export interface FrameBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** True when `point` is strictly inside `frame` bounds. */
export function pointInFrameBounds(point: CanvasPosition, frame: FrameBounds): boolean {
  return (
    point.x >= frame.x &&
    point.x <= frame.x + frame.width &&
    point.y >= frame.y &&
    point.y <= frame.y + frame.height
  );
}

/**
 * Find the topmost frame that contains `point`. When frames overlap, the
 * frame later in the array (higher `position` order) wins. Returns null
 * if no frame contains the point.
 */
export function frameContainingPoint(
  frames: CanvasFrame[],
  point: CanvasPosition
): CanvasFrame | null {
  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = frames[i]!;
    if (pointInFrameBounds(point, frame)) return frame;
  }
  return null;
}

/**
 * Compute the set of node IDs whose center falls inside the given frame's
 * bounds. Used at frame creation (auto-assign overlapping nodes) and after
 * frame resize (recompute membership for nodes now inside/outside).
 *
 * Uses the node centre (position + half measured dimensions) so that a node
 * must be majority-inside the frame to be included, not just touching at its
 * top-left corner.
 */
export function nodeIdsInsideFrame(
  nodes: ReadonlyArray<
    Pick<CanvasNode, "id" | "position"> & {
      measured?: { width?: number; height?: number };
    }
  >,
  frame: FrameBounds
): string[] {
  return nodes
    .filter((node) => {
      // Use centre of the node, not top-left corner.
      const cx = node.position.x + (node.measured?.width ?? 0) / 2;
      const cy = node.position.y + (node.measured?.height ?? 0) / 2;
      return pointInFrameBounds({ x: cx, y: cy }, frame);
    })
    .map((node) => node.id);
}

/**
 * Reconcile membership for a single node given its new position and the full
 * set of frames. Returns `{ assignTo, removeFrom }` where:
 * - `assignTo` is the frame the node should now belong to (null if outside all)
 * - `removeFrom` lists frames the node was previously in but should leave
 *
 * A node belongs to at most one frame; the topmost containing frame wins.
 */
export function reconcileNodeFrameMembership(
  nodeId: string,
  position: CanvasPosition,
  frames: CanvasFrame[]
): { assignTo: CanvasFrame | null; removeFrom: CanvasFrame[] } {
  const target = frameContainingPoint(frames, position);
  const removeFrom: CanvasFrame[] = [];
  for (const frame of frames) {
    if (frame.id === target?.id) continue;
    if (frame.node_ids.includes(nodeId)) removeFrom.push(frame);
  }
  return { assignTo: target, removeFrom };
}

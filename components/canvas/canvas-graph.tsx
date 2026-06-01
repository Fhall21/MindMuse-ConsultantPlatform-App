"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
  type NodeChange,
  type OnNodeDrag,
  type OnSelectionChangeFunc,
  type FitViewOptions,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useUpdateNodeInternals,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "@/components/canvas/canvas-handles.css";
import { Layers3, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { CanvasNodeCardData } from "@/components/canvas/canvas-node-card";
import {
  CanvasFrameNode,
  DropTargetFrameContext,
  type CanvasFrameNodeData,
} from "@/components/canvas/canvas-frame-node";
import { canvasFlowNodeTypes } from "@/components/canvas/canvas-flow-node-types";
import {
  buildFlowEdges,
  buildFlowNodes,
  edgeStyle,
  orderNodesParentFirst,
} from "@/lib/canvas-flow-builders";
import { useCanvas, useSaveLayout, type CreateEdgePayload } from "@/hooks/use-canvas";
import {
  buildCanvasReorganiseLayout,
  type CanvasLayoutDirection,
  type FrameBoundsRect,
  getDefaultGroupedPosition,
} from "@/lib/canvas-layout";
import { getDraggedInsightIds, resolveCanvasGroupingPlan } from "@/lib/canvas-interactions";
import {
  toggleExpandedOverride,
  type CardDensity,
} from "@/lib/canvas-card-density";
import type {
  CanvasEdge,
  CanvasFilterState,
  CanvasFrame,
  CanvasNode,
  ConnectionType,
  FrameColor,
} from "@/types/canvas";

interface CanvasGraphProps {
  roundId: string;
  filters: CanvasFilterState;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  aiGeneratedGroupIds?: Set<string>;
  layoutRequest?: { id: number; nodeIds: string[]; direction: CanvasLayoutDirection; frameBounds?: FrameBoundsRect } | null;
  /** When set, only these node IDs are rendered (frame visibility filter). */
  visibleNodeIds?: Set<string> | null;
  /** When set, the viewport is restored to this position. Increment id to trigger. */
  viewportRequest?: { id: number; viewport: { x: number; y: number; zoom: number } } | null;
  // ── Frame integration (sprint 16 task 03.5) ─────────────────────────────────
  /** All frames for the active consultation. Rendered as background nodes. */
  frames?: CanvasFrame[];
  /** When true, click-drag on the pane draws a new frame rectangle. */
  frameDrawingMode?: boolean;
  /** ID of the frame currently highlighted as a drop target during a drag. */
  dropTargetFrameId?: string | null;
  /** Fired when consultant releases the rubber-band rectangle. */
  onFrameDraw?: (
    bounds: { x: number; y: number; width: number; height: number },
    /** Live node positions at draw time — use instead of stale server snapshot. */
    liveNodes: Array<{ id: string; position: { x: number; y: number }; measured?: { width?: number; height?: number } }>
  ) => void;
  /** Fired when a frame is moved/resized. */
  onFramePersist?: (
    frameId: string,
    bounds: { x: number; y: number; width: number; height: number },
    /** Live node positions at persist time — use instead of stale server snapshot. */
    liveNodes: Array<{ id: string; position: { x: number; y: number }; measured?: { width?: number; height?: number } }>
  ) => void;
  /** Fired after a node drag settles — checks frame membership. */
  onNodeFrameAssign?: (nodeId: string, position: { x: number; y: number }) => void;
  /** Fired during node drag to update drop-target highlight. */
  onNodeFrameDragOver?: (nodeId: string, position: { x: number; y: number }) => void;
  /** Frame-level UI callbacks. */
  onFrameRename?: (frameId: string) => void;
  onFrameColorChange?: (frameId: string, color: FrameColor) => void;
  onSelectionChange: (nodeIds: string[]) => void;
  onNodeFocus: (id: string | null) => void;
  onEdgeSelect: (id: string | null) => void;
  onLayoutComplete?: (result: {
    applied: boolean;
    movedNodeIds: string[];
    scope: "selected" | "all";
    direction: CanvasLayoutDirection;
    /** Set when the frame needs to be expanded to contain the laid-out nodes. */
    suggestedFrameBounds?: FrameBoundsRect;
  }) => void;
  onCreateEdge: (payload: CreateEdgePayload) => Promise<CanvasEdge>;
  onGroupDrop: (params: {
    activeNodeId: string;
    targetNodeId: string | null;
    targetGroupId?: string | null;
    insertionIndex?: number;
  }) => Promise<void>;
  /** Called when user inline-edits a group card's name or description. */
  onRenameGroup?: (id: string, name: string, description: string) => void;
  /** Session-local card density — compact (default) or expanded. */
  cardDensity?: CardDensity;
}

// Canvas interaction contract:
// 1. Use React Flow local node state so drag stays locked to the cursor.
// 2. Keep persisted DB positions absolute and manage grouping in app state so
//    React Flow never needs nested parent/child nodes.
const nodeTypes = {
  ...canvasFlowNodeTypes,
  frameNode: CanvasFrameNode,
};

const FRAME_NODE_TYPE = "frameNode";

/**
 * Build ReactFlow nodes for canvas frames. Frames render at zIndex -1 so
 * they sit beneath theme/insight cards. Each frame is draggable and
 * resizable in place; data carries the frameId + color (drop-target flag
 * lives in DropTargetFrameContext, not in data, so updates don't churn
 * the node array during drag).
 */
function buildFrameFlowNodes(
  frames: CanvasFrame[],
  callbacks: {
    onColorChange?: (frameId: string, color: FrameColor) => void;
    onRename?: (frameId: string) => void;
  }
): Node[] {
  return frames.map((frame) => ({
    id: `frame:${frame.id}`,
    type: FRAME_NODE_TYPE,
    position: { x: frame.x, y: frame.y },
    width: frame.width,
    height: frame.height,
    style: { width: frame.width, height: frame.height },
    draggable: true,
    selectable: true,
    zIndex: -1,
    data: {
      frameId: frame.id,
      name: frame.name,
      color: frame.color,
      onColorChange: callbacks.onColorChange,
      onRename: callbacks.onRename,
    } satisfies CanvasFrameNodeData,
  } satisfies Node));
}

/**
 * Sync server-supplied frame flow nodes into the local useNodesState. When a
 * frame's id matches a current local node, we keep its runtime position +
 * dimensions (so an in-flight drag/resize isn't snapped back). Other fields
 * (name, color, callbacks) update from the server snapshot.
 */
function syncFrameFlowNodes(
  currentNodes: Node[],
  nextNodes: Node[]
): Node[] {
  const currentById = new Map(currentNodes.map((n) => [n.id, n] as const));
  return nextNodes.map((next) => {
    const current = currentById.get(next.id);
    if (!current) return next;
    return {
      ...next,
      position: current.position,
      width: current.width ?? next.width,
      height: current.height ?? next.height,
      style: current.style ?? next.style,
      selected: current.selected,
    } satisfies Node;
  });
}

/** True when a node id is a frame's flow-node id (prefixed `frame:`). */
function isFrameFlowNodeId(id: string) {
  return id.startsWith("frame:");
}

/** Extract DB frameId from a flow-node id (`frame:<uuid>` → `<uuid>`). */
function frameIdFromFlowId(flowId: string) {
  return flowId.slice("frame:".length);
}

/** Test if a point is inside a frame's bounding box (canvas flow coords). */
function pointInFrame(point: { x: number; y: number }, frame: CanvasFrame) {
  return (
    point.x >= frame.x &&
    point.x <= frame.x + frame.width &&
    point.y >= frame.y &&
    point.y <= frame.y + frame.height
  );
}

function equalStringSets(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }

  const bSet = new Set(b);
  return a.every((item) => bSet.has(item));
}

function applyFilters(nodes: CanvasNode[], edges: CanvasEdge[], filters: CanvasFilterState) {
  const query = filters.searchQuery.trim().toLowerCase();

  const filteredNodes = nodes.filter((node) => {
    if (!filters.nodeTypes.includes(node.type)) return false;
    if (filters.acceptedOnly && !node.accepted) return false;
    if (query && !`${node.label} ${node.description ?? ""}`.toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });

  const visibleIds = new Set(filteredNodes.map((node) => node.id));
  const filteredEdges = edges.filter(
    (edge) =>
      filters.connectionTypes.includes(edge.connection_type) &&
      visibleIds.has(edge.source_node_id) &&
      visibleIds.has(edge.target_node_id)
  );

  return { filteredNodes, filteredEdges };
}

function syncFlowNodes(
  currentNodes: Node[],
  nextNodes: Node[],
  selectedNodeIds: string[],
  pendingGroupJoins: Set<string>
) {
  const currentById = new Map(currentNodes.map((node) => [node.id, node] as const));
  const nextById = new Map(nextNodes.map((node) => [node.id, node] as const));
  const selectedSet = new Set(selectedNodeIds);

  return orderNodesParentFirst(
    nextNodes.map((nextNode) => {
      const currentNode = currentById.get(nextNode.id);
      const currentData = currentNode?.data as unknown as CanvasNodeCardData | undefined;
      const nextData = nextNode.data as unknown as CanvasNodeCardData;

      // Don't preserve position when an insight has just been added to a group —
      // it needs to animate to its slot inside the group card.
      // Do preserve position when an insight just left a group — the user dragged
      // it out, so we honour the drop position even before persistLayout flushes.
      const currentGroupId = currentData?.node?.groupId ?? null;
      const nextGroupId = nextData?.node?.groupId ?? null;
      const groupIdChanged = currentGroupId !== nextGroupId;
      const leftGroup = currentGroupId !== null && nextGroupId === null;
      // Stale-server case: local state already detached (groupId=null) but server
      // data hasn't caught up yet (still shows groupId set). Preserve local
      // position AND data so the node doesn't snap back mid-flight.
      // Exception: if this node is in pendingGroupJoins it's being newly added to
      // a group via handleGroupConfirm — accept the server position instead.
      const justDetached = currentNode && currentGroupId === null && nextGroupId !== null && !pendingGroupJoins.has(nextNode.id);
      if (justDetached) {
        return {
          ...nextNode,
          position: currentNode.position,
          selected: selectedSet.has(nextNode.id),
          data: {
            ...currentData,
            expanded: currentData?.expanded,
          },
        } satisfies Node;
      }

      const shouldPreservePosition =
        currentNode && currentNode.type === nextNode.type && (!groupIdChanged || leftGroup);

      if (shouldPreservePosition) {
        return {
          ...nextNode,
          position: currentNode.position,
          selected: selectedSet.has(nextNode.id),
          data: {
            ...nextData,
            expanded: currentData?.expanded,
          },
        } satisfies Node;
      }

      // Carry expanded state even when not preserving position.
      const dataWithExpanded = currentData?.expanded !== undefined
        ? { ...nextData, expanded: currentData.expanded }
        : nextData;

      // For grouped insights re-entering after their parent group was dragged,
      // shift by the delta between the group's runtime position and its DB-based position.
      const groupId = nextGroupId;
      if (groupId && !groupIdChanged) {
        const currentGroupNode = currentById.get(groupId);
        const nextGroupNode = nextById.get(groupId);
        if (currentGroupNode && nextGroupNode) {
          const deltaX = currentGroupNode.position.x - nextGroupNode.position.x;
          const deltaY = currentGroupNode.position.y - nextGroupNode.position.y;
          if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
            return {
              ...nextNode,
              position: {
                x: nextNode.position.x + deltaX,
                y: nextNode.position.y + deltaY,
              },
              selected: selectedSet.has(nextNode.id),
              data: dataWithExpanded,
            } satisfies Node;
          }
        }
      }

      return {
        ...nextNode,
        selected: selectedSet.has(nextNode.id),
        data: dataWithExpanded,
      } satisfies Node;
    })
  );
}

function syncFlowEdges(currentEdges: Edge[], nextEdges: Edge[], selectedEdgeId: string | null) {
  const currentById = new Map(currentEdges.map((edge) => [edge.id, edge] as const));

  return nextEdges.map((nextEdge) => ({
    ...nextEdge,
    animated: selectedEdgeId === nextEdge.id,
    selected: selectedEdgeId === nextEdge.id,
    data: currentById.get(nextEdge.id)?.data,
  } satisfies Edge));
}

function buildLayoutPositions(allNodes: Node[], nodesById: Map<string, CanvasNode>) {
  return Object.fromEntries(
    allNodes
      .map((node) => {
        const original = nodesById.get(node.id);
        if (!original) {
          return null;
        }

        return [
          node.id,
          {
            nodeType: original.type,
            x: node.position.x,
            y: node.position.y,
          },
        ];
      })
      .filter(Boolean) as Array<[string, { nodeType: CanvasNode["type"]; x: number; y: number }]>
  );
}

function getFlowCanvasNode(node: Node) {
  const data = node.data as unknown as CanvasNodeCardData | undefined;

  return data?.node ?? null;
}

function resolveDropTargetNode(intersectingNodeIds: string[], nodes: Node[], draggedNodeId: string) {
  const candidates = intersectingNodeIds
    .filter((candidateId) => candidateId !== draggedNodeId)
    .map((candidateId) => nodes.find((candidate) => candidate.id === candidateId) ?? null)
    .filter((candidate): candidate is Node => Boolean(candidate));

  return (
    candidates.find((candidate) => getFlowCanvasNode(candidate)?.type === "insight") ??
    candidates.find((candidate) => getFlowCanvasNode(candidate)?.type === "theme") ??
    null
  );
}

function detachInsightsFromGroup(nodes: Node[], insightIds: string[], oldGroupId: string) {
  const detachSet = new Set(insightIds);
  const withDetached = nodes.map((candidate) => {
    if (!detachSet.has(candidate.id)) return candidate;
    const canvasNode = getFlowCanvasNode(candidate);
    if (!canvasNode || canvasNode.type !== "insight") return candidate;
    return {
      ...candidate,
      data: {
        ...candidate.data,
        node: { ...canvasNode, groupId: null },
        isNestedInGroup: false,
      },
    } satisfies Node;
  });
  return snapGroupChildren(withDetached, oldGroupId);
}

function snapGroupChildren(nodes: Node[], groupId: string) {
  const groupChildren = getOrderedGroupChildren(nodes, groupId);
  const groupNode = nodes.find((candidate) => candidate.id === groupId);

  if (groupChildren.length === 0 || !groupNode) {
    return nodes;
  }

  const snappedPositions = new Map(
    groupChildren.map((child, index) => [child.id, getDefaultGroupedPosition(index)] as const)
  );

  return nodes.map((candidate) => {
    const canvasNode = getFlowCanvasNode(candidate);
    if (candidate.id === groupId || canvasNode?.groupId !== groupId) {
      return candidate;
    }

    const snappedPosition = snappedPositions.get(candidate.id);
    if (!snappedPosition) {
      return candidate;
    }

    return {
      ...candidate,
      position: {
        x: groupNode.position.x + snappedPosition.x,
        y: groupNode.position.y + snappedPosition.y,
      },
    } satisfies Node;
  });
}

function getOrderedGroupChildren(nodes: Node[], groupId: string) {
  return nodes
    .filter((candidate) => getFlowCanvasNode(candidate)?.groupId === groupId)
    .sort((left, right) => {
      if (left.position.y === right.position.y) {
        return left.position.x - right.position.x;
      }

      return left.position.y - right.position.y;
    });
}

function reorderGroupChildren(params: {
  nodes: Node[];
  groupId: string;
  draggedNodeIds: string[];
  insertionIndex: number;
}) {
  const { nodes, groupId, draggedNodeIds, insertionIndex } = params;
  const groupChildren = getOrderedGroupChildren(nodes, groupId);
  const groupNode = nodes.find((candidate) => candidate.id === groupId);
  if (!groupNode) {
    return nodes;
  }
  const draggedSet = new Set(draggedNodeIds);
  const reorderedIds = groupChildren
    .map((child) => child.id)
    .filter((childId) => !draggedSet.has(childId));
  const boundedIndex = Math.max(0, Math.min(insertionIndex, reorderedIds.length));

  reorderedIds.splice(boundedIndex, 0, ...draggedNodeIds);

  const snappedPositions = new Map(
    reorderedIds.map((childId, index) => [childId, getDefaultGroupedPosition(index)] as const)
  );

  return nodes.map((candidate) => {
    const canvasNode = getFlowCanvasNode(candidate);
    if (!draggedSet.has(candidate.id) && canvasNode?.groupId !== groupId) {
      return candidate;
    }

    const snappedPosition = snappedPositions.get(candidate.id);
    if (!snappedPosition) {
      return candidate;
    }

    return {
      ...candidate,
      position: {
        x: groupNode.position.x + snappedPosition.x,
        y: groupNode.position.y + snappedPosition.y,
      },
    } satisfies Node;
  });
}

function translateGroupChildren(nodes: Node[], groupId: string, delta: { x: number; y: number }) {
  return nodes.map((candidate) => {
    const canvasNode = getFlowCanvasNode(candidate);
    if (candidate.id === groupId || canvasNode?.groupId !== groupId) {
      return candidate;
    }

    return {
      ...candidate,
      position: {
        x: candidate.position.x + delta.x,
        y: candidate.position.y + delta.y,
      },
    } satisfies Node;
  });
}

function applyThemeDragTranslations(changes: NodeChange[], currentNodes: Node[]) {
  const themeDeltas = new Map<string, { x: number; y: number }>();

  for (const change of changes) {
    if (change.type !== "position" || !change.position) {
      continue;
    }

    const currentNode = currentNodes.find((candidate) => candidate.id === change.id);
    if (!currentNode) {
      continue;
    }

    const canvasNode = getFlowCanvasNode(currentNode);
    if (canvasNode?.type !== "theme") {
      continue;
    }

    themeDeltas.set(change.id, {
      x: change.position.x - currentNode.position.x,
      y: change.position.y - currentNode.position.y,
    });
  }

  if (themeDeltas.size === 0) {
    return applyNodeChanges(changes, currentNodes);
  }

  let nextNodes = applyNodeChanges(changes, currentNodes);

  for (const [groupId, delta] of themeDeltas.entries()) {
    if (Math.abs(delta.x) < 0.5 && Math.abs(delta.y) < 0.5) {
      continue;
    }

    nextNodes = translateGroupChildren(nextNodes, groupId, delta);
  }

  return nextNodes;
}

export interface CanvasGraphHandle {
  fitView: (opts?: FitViewOptions) => void;
  getLayoutItems(): Array<{ id: string; text: string }>;
  getTopLevelPositions(): Record<string, { x: number; y: number }>;
  applyPositions(positions: Record<string, { x: number; y: number }>, opts?: { animate?: boolean }): void;
  getLayoutSavePending(): boolean;
  /** Force-revert local flow state to current server-computed nodes. Use after
   *  a failed mutation to undo any optimistic updates that were applied. */
  revertNodes(): void;
  /** Cancel any pending debounced layout save. Call before reverting nodes so
   *  the optimistic drop position is not persisted to the layout DB. */
  cancelPendingLayout(): void;
  /** Mark insight IDs as being newly added to a group so that syncFlowNodes
   *  accepts the incoming server positions rather than preserving stale positions. */
  markGroupJoin(insightIds: string[]): void;
}

const CanvasGraphInner = forwardRef<CanvasGraphHandle, CanvasGraphProps>(function CanvasGraphInner({
  roundId,
  filters,
  selectedNodeIds,
  selectedEdgeId,
  aiGeneratedGroupIds = new Set(),
  layoutRequest,
  visibleNodeIds,
  viewportRequest,
  frames = [],
  frameDrawingMode = false,
  dropTargetFrameId = null,
  onFrameDraw,
  onFramePersist,
  onNodeFrameAssign,
  onNodeFrameDragOver,
  onFrameRename,
  onFrameColorChange,
  onSelectionChange,
  onNodeFocus,
  onEdgeSelect,
  onLayoutComplete,
  onCreateEdge,
  onGroupDrop,
  onRenameGroup,
  cardDensity = "compact",
}: CanvasGraphProps, ref) {
  const { data, isLoading } = useCanvas(roundId);
  const saveLayout = useSaveLayout(roundId);
  const { getViewport, getIntersectingNodes, setViewport, screenToFlowPosition, updateNodeData, fitView } =
    useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const dragRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragSelectionRef = useRef(false);
  const clickHandlingRef = useRef(false);
  const initialSeedSaveRef = useRef<string | null>(null);
  const processedLayoutRequestRef = useRef<number | null>(null);
  const [hasQueuedSave, setHasQueuedSave] = useState(false);
  const [hasHydratedGraph, setHasHydratedGraph] = useState(false);
  const lastViewportRef = useRef(data?.viewport ?? { x: 0, y: 0, zoom: 1 });

  const selectedNodeIdsRef = useRef(selectedNodeIds);
  selectedNodeIdsRef.current = selectedNodeIds;
  const layoutRequestRef = useRef(layoutRequest);
  layoutRequestRef.current = layoutRequest;

  const nodesDataRef = useRef(data?.nodes ?? []);
  nodesDataRef.current = data?.nodes ?? [];

  const nodesById = useMemo(
    () => new Map((data?.nodes ?? []).map((node) => [node.id, node] as const)),
    [data?.nodes]
  );
  const nodesByIdRef = useRef(nodesById);
  nodesByIdRef.current = nodesById;
  const getViewportRef = useRef(getViewport);
  getViewportRef.current = getViewport;
  const onLayoutCompleteRef = useRef(onLayoutComplete);
  onLayoutCompleteRef.current = onLayoutComplete;

  const { filteredNodes: filterPassNodes, filteredEdges: filterPassEdges } = useMemo(
    () => applyFilters(data?.nodes ?? [], data?.edges ?? [], filters),
    [data?.nodes, data?.edges, filters]
  );

  const filteredNodes = useMemo(
    () =>
      visibleNodeIds
        ? filterPassNodes.filter(
            // Show a node if it is directly in the frame, OR if it is a grouped
            // insight whose parent theme is in the frame. Without this, switching
            // to a frame that contains a theme hides all of that theme's children
            // because child insight IDs are not stored in frame.node_ids.
            (n) => visibleNodeIds.has(n.id) || !!(n.groupId && visibleNodeIds.has(n.groupId))
          )
        : filterPassNodes,
    [filterPassNodes, visibleNodeIds]
  );
  const filteredEdges = useMemo(
    () =>
      visibleNodeIds
        ? filterPassEdges.filter((e) => {
            // An edge is visible when both its endpoints are reachable in the
            // current frame. An endpoint is reachable if its own ID is in the
            // frame, OR if it belongs to a theme that is in the frame.
            const sourceNode = filterPassNodes.find((n) => n.id === e.source_node_id);
            const targetNode = filterPassNodes.find((n) => n.id === e.target_node_id);
            const sourceVisible =
              visibleNodeIds.has(e.source_node_id) ||
              !!(sourceNode?.groupId && visibleNodeIds.has(sourceNode.groupId));
            const targetVisible =
              visibleNodeIds.has(e.target_node_id) ||
              !!(targetNode?.groupId && visibleNodeIds.has(targetNode.groupId));
            return sourceVisible && targetVisible;
          })
        : filterPassEdges,
    [filterPassEdges, filterPassNodes, visibleNodeIds]
  );

  const viewportRequestRef = useRef(viewportRequest);
  viewportRequestRef.current = viewportRequest;
  const setViewportRef = useRef(setViewport);
  setViewportRef.current = setViewport;

  useEffect(() => {
    if (!viewportRequest) return;
    setViewportRef.current(viewportRequest.viewport, { duration: 300 });
  }, [viewportRequest?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const allFlowNodes = useMemo(
    () => buildFlowNodes(data?.nodes ?? [], aiGeneratedGroupIds),
    [data?.nodes, aiGeneratedGroupIds]
  );
  const normalizedAllPositions = useMemo(
    () => buildLayoutPositions(allFlowNodes, nodesById),
    [allFlowNodes, nodesById]
  );
  const normalizedLayoutSignature = useMemo(
    () =>
      Object.entries(normalizedAllPositions)
        .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
        .map(([id, position]) => `${id}:${position.x}:${position.y}`)
        .join("|"),
    [normalizedAllPositions]
  );
  const needsLayoutNormalization = useMemo(
    () =>
      Object.entries(normalizedAllPositions).some(([nodeId, position]) => {
        const original = nodesById.get(nodeId);

        return (
          original &&
          (Math.abs(original.position.x - position.x) > 0.5 ||
            Math.abs(original.position.y - position.y) > 0.5)
        );
      }),
    [nodesById, normalizedAllPositions]
  );

  const nextFlowNodes = useMemo(
    () => buildFlowNodes(filteredNodes, aiGeneratedGroupIds),
    [filteredNodes, aiGeneratedGroupIds]
  );
  const nextFlowNodesRef = useRef(nextFlowNodes);
  nextFlowNodesRef.current = nextFlowNodes;

  const nextFlowEdges = useMemo(() => buildFlowEdges(filteredEdges), [filteredEdges]);

  const [flowNodes, setFlowNodes] = useNodesState(nextFlowNodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(nextFlowEdges);

  // Frame flow nodes are stateful — RF tracks position/dimensions locally
  // during drag/resize, which keeps interaction smooth (60fps). We sync
  // from the server `frames` prop when it changes (new frames added,
  // server-side updates) but preserve in-flight drag positions.
  const nextFrameFlowNodes = useMemo(
    () =>
      buildFrameFlowNodes(frames, {
        onColorChange: onFrameColorChange,
        onRename: onFrameRename,
      }),
    [frames, onFrameColorChange, onFrameRename]
  );
  const [frameFlowNodes, setFrameFlowNodes] = useNodesState(nextFrameFlowNodes);
  useEffect(() => {
    setFrameFlowNodes((current) => syncFrameFlowNodes(current, nextFrameFlowNodes));
  }, [nextFrameFlowNodes, setFrameFlowNodes]);

  // Render frames first (lower z-index) so node-card hit tests work normally
  // for theme/insight nodes, then theme/insight nodes on top.
  const renderedFlowNodes = useMemo(
    () => [...frameFlowNodes, ...orderNodesParentFirst(flowNodes)],
    [frameFlowNodes, flowNodes]
  );
  const flowNodesRef = useRef(flowNodes);
  flowNodesRef.current = flowNodes;
  const cardDensityRef = useRef(cardDensity);
  cardDensityRef.current = cardDensity;

  const handleToggleExpand = useCallback(
    (nodeId: string) => {
      setFlowNodes((currentNodes) => {
        const target = currentNodes.find((node) => node.id === nodeId);
        if (!target) return currentNodes;

        const cardData = target.data as unknown as CanvasNodeCardData;
        const nextExpanded = toggleExpandedOverride(
          cardData.expanded,
          cardDensityRef.current
        );

        updateNodeData(nodeId, { expanded: nextExpanded });

        return currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...cardData,
                  expanded: nextExpanded,
                  globalDensity: cardDensityRef.current,
                  onToggleExpand: handleToggleExpand,
                },
              }
            : node
        );
      });

      requestAnimationFrame(() => updateNodeInternals(nodeId));
    },
    [setFlowNodes, updateNodeData, updateNodeInternals]
  );

  const attachCardUiData = useCallback(
    (node: Node) => {
      const data = node.data as unknown as CanvasNodeCardData;
      return {
        ...node,
        data: {
          ...data,
          globalDensity: cardDensity,
          onToggleExpand: handleToggleExpand,
          onRenameGroup,
        },
      } satisfies Node;
    },
    [cardDensity, handleToggleExpand, onRenameGroup]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Split changes by node kind so frame nodes stay in their own state
      // (smooth drag) and theme/insight nodes keep going through the
      // grouping translation pipeline.
      const themeInsightChanges: NodeChange[] = [];
      const frameChanges: NodeChange[] = [];

      for (const change of changes) {
        const changeId = (change as { id?: string }).id;
        if (changeId && isFrameFlowNodeId(changeId)) {
          frameChanges.push(change);
        } else {
          themeInsightChanges.push(change);
        }
      }

      // ── Frame state — apply via xyflow's applyNodeChanges so drag/resize
      // updates RF's local position/dimensions in sync with the cursor.
      if (frameChanges.length > 0) {
        setFrameFlowNodes((currentNodes) =>
          applyNodeChanges(frameChanges, currentNodes)
        );

        // Persist on settle (drag-end / resize-end). Reads from
        // currentNodes after applyNodeChanges so the persisted bounds
        // match what RF just rendered.
        // Snapshot live non-frame node positions once per batch, before
        // entering the setFrameFlowNodes setter which reads stale closure state.
        // Child nodes (parentId set = grouped insights) are excluded — their
        // positions are parent-relative and they are not tracked in frame.node_ids.
        const liveNodesSnapshot = flowNodesRef.current
          .filter((n) => !n.parentId)
          .map((n) => ({ id: n.id, position: n.position, measured: n.measured }));

        for (const change of frameChanges) {
          const settled =
            (change.type === "position" && change.dragging === false) ||
            (change.type === "dimensions" && change.resizing === false);
          if (!settled) continue;

          const frameId = frameIdFromFlowId((change as { id: string }).id);
          // Look up the latest local node state via ref-style closure: we
          // call setFrameFlowNodes again with an inspector that reads the
          // freshly-applied node and fires the persist callback exactly once.
          setFrameFlowNodes((currentNodes) => {
            const node = currentNodes.find((n) => n.id === `frame:${frameId}`);
            if (node) {
              const width =
                (typeof node.width === "number" ? node.width : undefined) ??
                (typeof node.style?.width === "number" ? node.style.width : undefined) ??
                0;
              const height =
                (typeof node.height === "number" ? node.height : undefined) ??
                (typeof node.style?.height === "number" ? node.style.height : undefined) ??
                0;
              onFramePersist?.(frameId, {
                x: node.position.x,
                y: node.position.y,
                width,
                height,
              }, liveNodesSnapshot);
            }
            return currentNodes;
          });
        }
      }

      if (themeInsightChanges.length > 0) {
        setFlowNodes((currentNodes) =>
          orderNodesParentFirst(applyThemeDragTranslations(themeInsightChanges, currentNodes))
        );
      }
    },
    [setFlowNodes, setFrameFlowNodes, onFramePersist]
  );

  // Preserve runtime positions while dragging/selecting. Recomputing from server
  // data on every render reintroduces cursor lag and snap-back.
  useEffect(() => {
    // Capture and clear before the state update so each refetch cycle consumes
    // the set exactly once.
    const pendingJoins = pendingGroupJoinsRef.current;
    pendingGroupJoinsRef.current = new Set();
    setFlowNodes((currentNodes) =>
      syncFlowNodes(currentNodes, nextFlowNodes, selectedNodeIds, pendingJoins).map((node) =>
        attachCardUiData(node)
      )
    );
  }, [nextFlowNodes, selectedNodeIds, setFlowNodes, attachCardUiData]);

  useEffect(() => {
    setFlowEdges((currentEdges) =>
      syncFlowEdges(currentEdges, nextFlowEdges, selectedEdgeId)
    );
  }, [nextFlowEdges, selectedEdgeId, setFlowEdges]);

  useEffect(() => {
    if (data) {
      setHasHydratedGraph(true);
      lastViewportRef.current = data.viewport;
    }
  }, [data]);

  const saveLayoutNow = useCallback(
    (positions: Record<string, { nodeType: CanvasNode["type"]; x: number; y: number }>, viewport: { x: number; y: number; zoom: number }) => {
      setHasQueuedSave(false);
      saveLayout.mutate(
        {
          positions,
          viewport,
        },
        {
          onError: (error) => {
            console.error("[canvas-graph] failed to save layout", error);
            toast.error("Failed to save canvas layout.");
          },
        }
      );
    },
    [saveLayout]
  );
  const saveLayoutNowRef = useRef(saveLayoutNow);
  saveLayoutNowRef.current = saveLayoutNow;

  // Insight IDs that are being newly added to a group via handleGroupConfirm.
  // syncFlowNodes reads this set to skip the justDetached guard for those nodes.
  const pendingGroupJoinsRef = useRef(new Set<string>());

  // Refreshed each render so getLayoutSavePending() never needs to be in handle deps.
  const savePendingRef = useRef(false);
  savePendingRef.current = hasQueuedSave || saveLayout.isPending;

  useImperativeHandle(
    ref,
    () => ({
      fitView,

      getLayoutItems() {
        const items: Array<{ id: string; text: string }> = [];
        for (const node of nodesDataRef.current) {
          if (node.type === "theme") {
            const memberTexts = node.memberIds
              .map((memberId) => {
                const member = nodesByIdRef.current.get(memberId);
                if (!member) return null;
                return [member.label, member.description].filter(Boolean).join(" ");
              })
              .filter((t): t is string => Boolean(t));
            const text = [node.label, node.description, ...memberTexts]
              .filter(Boolean)
              .join(" ");
            items.push({ id: node.id, text });
          } else if (node.type === "insight" && node.groupId == null) {
            const text = [node.label, node.description].filter(Boolean).join(" ");
            items.push({ id: node.id, text });
          }
          // grouped children and frames are excluded
        }
        return items;
      },

      getTopLevelPositions() {
        const result: Record<string, { x: number; y: number }> = {};
        for (const flowNode of flowNodesRef.current) {
          if (isFrameFlowNodeId(flowNode.id)) continue;
          const cn = getFlowCanvasNode(flowNode);
          if (!cn) continue;
          if (cn.type === "theme" || (cn.type === "insight" && cn.groupId == null)) {
            result[flowNode.id] = { x: flowNode.position.x, y: flowNode.position.y };
          }
        }
        return result;
      },

      applyPositions(positions, opts) {
        const animate = opts?.animate ?? true;
        const prefersReducedMotion =
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const transition =
          animate && !prefersReducedMotion
            ? "transform 600ms cubic-bezier(0.22,1,0.36,1)"
            : undefined;

        const movedIds = new Set<string>();
        let nextNodes = flowNodesRef.current.map((node) => {
          const newPos = positions[node.id];
          if (!newPos) return node;
          movedIds.add(node.id);
          return {
            ...node,
            position: { x: newPos.x, y: newPos.y },
            style: transition
              ? { ...node.style, transition }
              : node.style,
          } satisfies Node;
        });

        // Translate grouped children to preserve their offsets relative to their theme.
        for (const [themeId, newPos] of Object.entries(positions)) {
          const currentTheme = flowNodesRef.current.find((n) => n.id === themeId);
          if (!currentTheme) continue;
          const cn = getFlowCanvasNode(currentTheme);
          if (cn?.type !== "theme") continue;
          const delta = {
            x: newPos.x - currentTheme.position.x,
            y: newPos.y - currentTheme.position.y,
          };
          if (Math.abs(delta.x) > 0.5 || Math.abs(delta.y) > 0.5) {
            nextNodes = translateGroupChildren(nextNodes, themeId, delta);
          }
        }

        nextNodes = orderNodesParentFirst(nextNodes);
        flowNodesRef.current = nextNodes;
        setFlowNodes(nextNodes);

        // Persist immediately (no debounce) — this is an explicit user action.
        saveLayoutNowRef.current(
          buildLayoutPositions(nextNodes, nodesByIdRef.current),
          getViewportRef.current()
        );

        // Clear transition after animation completes.
        if (transition) {
          setTimeout(() => {
            setFlowNodes((currentNodes) =>
              currentNodes.map((node) => {
                if (!movedIds.has(node.id)) return node;
                const nextStyle = { ...node.style };
                delete nextStyle.transition;
                return { ...node, style: nextStyle } satisfies Node;
              })
            );
          }, 640);
        }
      },

      getLayoutSavePending() {
        return savePendingRef.current;
      },

      revertNodes() {
        // Bypass syncFlowNodes (and its optimistic guards like justDetached) and
        // reset local state to the current server-computed nodes. Call this after
        // a failed mutation to undo optimistic updates.
        setFlowNodes(nextFlowNodesRef.current);
      },

      cancelPendingLayout() {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
          setHasQueuedSave(false);
        }
      },

      markGroupJoin(insightIds: string[]) {
        for (const id of insightIds) {
          pendingGroupJoinsRef.current.add(id);
        }
      },
    }),
    // fitView is the only external dep; everything else is read via stable refs.
    [fitView, setFlowNodes]
  );

  useEffect(() => {
    if (!data) {
      return;
    }

    if (!(data.needs_initial_layout_save || needsLayoutNormalization)) {
      return;
    }

    const saveKey = `${roundId}:${normalizedLayoutSignature}`;
    if (initialSeedSaveRef.current === saveKey) {
      return;
    }

    initialSeedSaveRef.current = saveKey;
    saveLayoutNow(normalizedAllPositions, data.viewport);
  }, [data, needsLayoutNormalization, normalizedAllPositions, normalizedLayoutSignature, roundId, saveLayoutNow]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault();
      clickHandlingRef.current = true;
      const isMultiToggle = event.metaKey || event.ctrlKey || event.shiftKey;
      if (isMultiToggle) {
        const next = new Set(selectedNodeIdsRef.current);
        if (next.has(node.id)) {
          next.delete(node.id);
        } else {
          next.add(node.id);
        }
        onSelectionChange(Array.from(next));
        onNodeFocus(null);
      } else {
        onSelectionChange([node.id]);
        onNodeFocus(node.id);
      }
      onEdgeSelect(null);
      Promise.resolve().then(() => {
        clickHandlingRef.current = false;
      });
    },
    [onEdgeSelect, onNodeFocus, onSelectionChange]
  );

  const handleSelectionChange = useCallback<OnSelectionChangeFunc>(
    ({ nodes }) => {
      if (dragSelectionRef.current || clickHandlingRef.current) {
        return;
      }

      const nextIds = nodes.map((node) => node.id);
      if (equalStringSets(selectedNodeIdsRef.current, nextIds)) {
        return;
      }

      onSelectionChange(nextIds);
      onNodeFocus(nextIds.length > 0 ? nodes[nodes.length - 1]?.id ?? null : null);
    },
    [onNodeFocus, onSelectionChange]
  );

  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      onEdgeSelect(edge.id);
      onSelectionChange([]);
      onNodeFocus(null);
    },
    [onEdgeSelect, onNodeFocus, onSelectionChange]
  );

  const handlePaneClick = useCallback(() => {
    onSelectionChange([]);
    onNodeFocus(null);
    onEdgeSelect(null);
  }, [onEdgeSelect, onNodeFocus, onSelectionChange]);

  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return;
      }

      const sourceNode = nodesById.get(connection.source);
      const targetNode = nodesById.get(connection.target);
      if (!sourceNode || !targetNode) {
        return;
      }

      // User made a connection — dismiss any open undo-layout toast.
      toast.dismiss("layout-undo");

      try {
        const edge = await onCreateEdge({
          source_node_type: sourceNode.type,
          source_node_id: sourceNode.id,
          target_node_type: targetNode.type,
          target_node_id: targetNode.id,
          connection_type: "related_to",
        });

        onEdgeSelect(edge.id);
        onNodeFocus(null);
        onSelectionChange([]);
      } catch (error) {
        console.error("[canvas-graph] failed to create edge", error);
        onSelectionChange([]);
        onNodeFocus(null);
        onEdgeSelect(null);
        toast.error("Failed to create connection.");
      }
    },
    [nodesById, onCreateEdge, onEdgeSelect, onNodeFocus, onSelectionChange]
  );

  const persistLayout = useCallback(
    (allNodes: Node[]) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      setHasQueuedSave(true);
      saveTimerRef.current = setTimeout(() => {
        saveLayoutNow(buildLayoutPositions(allNodes, nodesById), getViewport());
      }, 1500);
    },
    [getViewport, nodesById, saveLayoutNow]
  );

  useEffect(
    () => () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (layoutResetTimerRef.current) {
        clearTimeout(layoutResetTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const nextLayoutRequest = layoutRequestRef.current;
    if (!data || !nextLayoutRequest) {
      return;
    }

    if (processedLayoutRequestRef.current === nextLayoutRequest.id) {
      return;
    }

    processedLayoutRequestRef.current = nextLayoutRequest.id;

    const runtimePositions = Object.fromEntries(
      flowNodesRef.current.map((node) => [node.id, node.position] as const)
    );
    const layoutResult = buildCanvasReorganiseLayout({
      nodes: nodesDataRef.current,
      edges: data.edges,
      selectedNodeIds: nextLayoutRequest.nodeIds,
      direction: nextLayoutRequest.direction,
      runtimePositions,
      frameBounds: nextLayoutRequest.frameBounds,
    });

    if (!layoutResult) {
      Promise.resolve().then(() =>
        onLayoutCompleteRef.current?.({
          applied: false,
          movedNodeIds: [],
          scope: nextLayoutRequest.nodeIds.length > 0 ? "selected" : "all",
          direction: nextLayoutRequest.direction,
        })
      );
      return;
    }

    if (layoutResetTimerRef.current) {
      clearTimeout(layoutResetTimerRef.current);
    }

    const transition = "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)";
    const nextNodes = orderNodesParentFirst(
      flowNodesRef.current.map((node) => {
        const nextPosition = layoutResult.positions[node.id];
        if (!nextPosition) {
          return node;
        }

        return {
          ...node,
          position: nextPosition,
          style: {
            ...node.style,
            transition,
          },
        } satisfies Node;
      })
    );

    flowNodesRef.current = nextNodes;
    setFlowNodes(nextNodes);
    saveLayoutNowRef.current(
      buildLayoutPositions(nextNodes, nodesByIdRef.current),
      getViewportRef.current()
    );

    layoutResetTimerRef.current = setTimeout(() => {
      setFlowNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (!(node.id in layoutResult.positions)) {
            return node;
          }

          const nextStyle = { ...node.style };
          delete nextStyle.transition;

          return {
            ...node,
            style: nextStyle,
          } satisfies Node;
        })
      );
    }, 320);

    Promise.resolve().then(() =>
      onLayoutCompleteRef.current?.({
        applied: true,
        movedNodeIds: layoutResult.movedNodeIds,
        scope: layoutResult.scope,
        direction: nextLayoutRequest.direction,
        suggestedFrameBounds: layoutResult.suggestedFrameBounds,
      })
    );
  }, [data, layoutRequest?.id, setFlowNodes]);

  const handleNodeDragStart: OnNodeDrag = useCallback((_event, node) => {
    // Frame nodes follow their own persistence path via handleNodesChange —
    // skip the theme/insight drag bookkeeping for them.
    if (isFrameFlowNodeId(node.id)) return;
    dragRef.current = node.id;
    dragSelectionRef.current = true;
  }, []);

  // Notify parent of drop-target frame highlights as the consultant drags
  // a regular (theme/insight) node across frames.
  const handleNodeDrag: OnNodeDrag = useCallback(
    (_event, node) => {
      if (isFrameFlowNodeId(node.id)) return;
      onNodeFrameDragOver?.(node.id, node.position);
    },
    [onNodeFrameDragOver]
  );

  const handleNodeDragStop: OnNodeDrag = useCallback(
    async (_event, node, allNodes) => {
      // User moved a node — dismiss any open undo-layout toast.
      toast.dismiss("layout-undo");

      // Frame node drag end is handled in handleNodesChange via the
      // onFramePersist callback — exit early so we don't run the
      // theme/insight grouping pipeline on frame nodes.
      if (isFrameFlowNodeId(node.id)) {
        // Membership recalculation happens in canvas-shell after persist —
        // here we only need to clear the drop highlight.
        onNodeFrameDragOver?.(node.id, node.position);
        return;
      }
      // After the drag settles, ask the parent to recalculate frame
      // membership for this node based on its final canvas position.
      // NOTE: deferred to after grouping determination below.
      // If the node is being grouped into a theme, it becomes a child node
      // with a parent-relative position — frame membership follows the parent
      // theme, so we must NOT add the insight to frame.node_ids individually.

      const draggedNodeId = dragRef.current ?? node.id;
      const draggedNodeBeforeDrag = nodesDataRef.current.find((candidate) => candidate.id === draggedNodeId);
      const runtimeNodes = flowNodesRef.current;
      const draggedNodeAfterDrop = runtimeNodes.find((candidate) => candidate.id === draggedNodeId) ?? allNodes.find((candidate) => candidate.id === draggedNodeId);
      const draggedInsightIds = getDraggedInsightIds({
        activeNodeId: draggedNodeId,
        selectedNodeIds: selectedNodeIdsRef.current,
        nodes: nodesDataRef.current,
      });
      const intersectingNodeIds = getIntersectingNodes(node).map((candidate) => candidate.id);
      const targetRuntimeNode = resolveDropTargetNode(intersectingNodeIds, runtimeNodes, draggedNodeId);
      const targetNodeId = targetRuntimeNode?.id ?? null;
      const targetCanvasNode = targetRuntimeNode ? getFlowCanvasNode(targetRuntimeNode) : null;
      const targetGroupId =
        targetCanvasNode?.type === "theme"
          ? targetCanvasNode.id
          : targetCanvasNode?.groupId ?? null;
      const groupChildren = targetGroupId ? getOrderedGroupChildren(runtimeNodes, targetGroupId) : [];
      const insertionIndex =
        targetCanvasNode?.type === "insight" && targetGroupId
          ? Math.max(
              0,
              groupChildren.findIndex((candidate) => candidate.id === targetCanvasNode.id)
            )
          : targetGroupId
            ? groupChildren.filter((candidate) => !draggedInsightIds.includes(candidate.id)).length
            : undefined;

      const plan = resolveCanvasGroupingPlan({
        activeNodeId: draggedNodeId,
        targetNodeId,
        selectedNodeIds: selectedNodeIdsRef.current,
        nodes: nodesDataRef.current,
      });

      const themeDelta =
        draggedNodeBeforeDrag?.type === "theme" && draggedNodeAfterDrop
          ? {
              x: draggedNodeAfterDrop.position.x - draggedNodeBeforeDrag.position.x,
              y: draggedNodeAfterDrop.position.y - draggedNodeBeforeDrag.position.y,
            }
          : null;

      const settledNodes =
        targetGroupId && draggedInsightIds.length > 0 && typeof insertionIndex === "number"
          ? reorderGroupChildren({
              nodes: runtimeNodes,
              groupId: targetGroupId,
              draggedNodeIds: draggedInsightIds,
              insertionIndex,
            })
          : draggedNodeBeforeDrag?.type === "theme" && themeDelta
            ? runtimeNodes
            : draggedNodeBeforeDrag?.type === "insight" && draggedNodeBeforeDrag.groupId && !targetNodeId
              ? detachInsightsFromGroup(runtimeNodes, draggedInsightIds, draggedNodeBeforeDrag.groupId)
              : plan.type === "noop" && draggedNodeBeforeDrag?.type === "insight" && draggedNodeBeforeDrag.groupId
                ? snapGroupChildren(runtimeNodes, draggedNodeBeforeDrag.groupId)
              : runtimeNodes;

      const settledFlowNodes = orderNodesParentFirst(settledNodes);
      setFlowNodes(settledFlowNodes);
      persistLayout(settledFlowNodes);
      dragRef.current = null;
      dragSelectionRef.current = false;

      // Now that we know whether the node is being grouped, recalculate frame
      // membership. Skip if the node is being absorbed into a theme group —
      // grouped insights are child nodes (parentId set, parent-relative pos)
      // and should not appear in frame.node_ids; frame membership follows the
      // parent theme node.
      const nodeIsBeingGrouped =
        !!targetGroupId &&
        draggedInsightIds.length > 0 &&
        typeof insertionIndex === "number";
      if (!nodeIsBeingGrouped) {
        onNodeFrameAssign?.(node.id, node.position);
      }

      if (targetGroupId && typeof insertionIndex === "number") {
        void onGroupDrop({
          activeNodeId: draggedNodeId,
          targetNodeId,
          targetGroupId,
          insertionIndex,
        });
      } else if (draggedNodeBeforeDrag?.type === "insight" && draggedNodeBeforeDrag.groupId && !targetNodeId) {
        void onGroupDrop({ activeNodeId: draggedNodeId, targetNodeId: null });
      }
    },
    [
      getIntersectingNodes,
      onGroupDrop,
      onNodeFrameAssign,
      onNodeFrameDragOver,
      persistLayout,
      setFlowNodes,
    ]
  );

  // ─── Frame drawing mode ──────────────────────────────────────────────────
  // When `frameDrawingMode` is on, mouse-down on the pane background starts
  // a rubber-band rect. Releasing fires `onFrameDraw` with flow-space bounds.
  // Mouse-down on existing nodes/frames is ignored (lets resize/drag still
  // work even while drawing mode is technically active).
  const [drawState, setDrawState] = useState<
    | null
    | {
        startScreen: { x: number; y: number };
        currentScreen: { x: number; y: number };
        startFlow: { x: number; y: number };
      }
  >(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const handleDrawMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!frameDrawingMode) return;
      const target = event.target as HTMLElement;
      // Only initiate drawing when the pane background is the target —
      // ignores clicks on existing nodes/frames so they still respond.
      if (!target.classList.contains("react-flow__pane")) return;
      event.preventDefault();
      const rect = wrapperRef.current?.getBoundingClientRect();
      const localX = event.clientX - (rect?.left ?? 0);
      const localY = event.clientY - (rect?.top ?? 0);
      const flow = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setDrawState({
        startScreen: { x: localX, y: localY },
        currentScreen: { x: localX, y: localY },
        startFlow: { x: flow.x, y: flow.y },
      });
    },
    [frameDrawingMode, screenToFlowPosition]
  );

  const handleDrawMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!drawState) return;
      const rect = wrapperRef.current?.getBoundingClientRect();
      const localX = event.clientX - (rect?.left ?? 0);
      const localY = event.clientY - (rect?.top ?? 0);
      setDrawState({ ...drawState, currentScreen: { x: localX, y: localY } });
    },
    [drawState]
  );

  const handleDrawMouseUp = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!drawState) return;
      const endFlow = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const x = Math.min(drawState.startFlow.x, endFlow.x);
      const y = Math.min(drawState.startFlow.y, endFlow.y);
      const width = Math.abs(endFlow.x - drawState.startFlow.x);
      const height = Math.abs(endFlow.y - drawState.startFlow.y);
      setDrawState(null);
      // Ignore tiny drags (treat as accidental click).
      if (width < 40 || height < 40) return;
      onFrameDraw?.(
        { x, y, width, height },
        flowNodesRef.current
          .filter((n) => !n.parentId)
          .map((n) => ({ id: n.id, position: n.position, measured: n.measured }))
      );
    },
    [drawState, onFrameDraw, screenToFlowPosition]
  );

  if (!hasHydratedGraph && (isLoading || !data)) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading evidence network…
      </div>
    );
  }

  // Rubber-band rect overlay (frame drawing). Rendered as a div over the
  // canvas wrapper while a drag is in progress.
  const drawOverlay = drawState ? (() => {
    const left = Math.min(drawState.startScreen.x, drawState.currentScreen.x);
    const top = Math.min(drawState.startScreen.y, drawState.currentScreen.y);
    const width = Math.abs(drawState.currentScreen.x - drawState.startScreen.x);
    const height = Math.abs(drawState.currentScreen.y - drawState.startScreen.y);
    return (
      <div
        className="pointer-events-none absolute z-50 rounded-lg border-2 border-blue-500/70 bg-blue-500/8"
        style={{ left, top, width, height }}
      />
    );
  })() : null;

  return (
    <DropTargetFrameContext.Provider value={dropTargetFrameId ?? null}>
    <div
      ref={wrapperRef}
      className="evidence-canvas relative h-full w-full"
      onMouseDown={handleDrawMouseDown}
      onMouseMove={handleDrawMouseMove}
      onMouseUp={handleDrawMouseUp}
      style={frameDrawingMode ? { cursor: "crosshair" } : undefined}
    >
      <ReactFlow
        nodes={renderedFlowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        defaultViewport={data?.viewport ?? lastViewportRef.current}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onSelectionChange={handleSelectionChange}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleConnect}
        connectionRadius={48}
        multiSelectionKeyCode={["Meta", "Control", "Shift"]}
        // Disable selection-on-drag and pan-on-drag while drawing a frame so
        // the rubber-band gesture isn't intercepted.
        selectionOnDrag={!frameDrawingMode}
        panOnDrag={!frameDrawingMode}
        panOnScroll
        fitView={false}
        minZoom={0.15}
        maxZoom={2}
        defaultEdgeOptions={{
          style: edgeStyle("related_to"),
        }}
      >
        <Background gap={16} size={1} />
        {hasQueuedSave || saveLayout.isPending ? (
          <Panel position="top-right">
            <div className="flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving layout…
            </div>
          </Panel>
        ) : null}
        {frameDrawingMode ? (
          <Panel position="top-left">
            <div className="rounded-full border bg-background/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur">
              Click and drag to draw a frame · press Esc to cancel
            </div>
          </Panel>
        ) : null}
        {null}
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
      </ReactFlow>
      {drawOverlay}
    </div>
    </DropTargetFrameContext.Provider>
  );
});

export const CanvasGraph = forwardRef<CanvasGraphHandle, CanvasGraphProps>(function CanvasGraph(props, ref) {
  return (
    <ReactFlowProvider>
      <CanvasGraphInner {...props} ref={ref} />
    </ReactFlowProvider>
  );
});

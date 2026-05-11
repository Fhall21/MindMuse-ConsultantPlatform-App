"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import posthog from "posthog-js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CanvasGraph } from "@/components/canvas/canvas-graph";
import { CanvasOrganiseMenu } from "@/components/canvas/canvas-organise-menu";
import { CanvasFrameBar } from "@/components/canvas/canvas-frame-bar";
import { CanvasClutterBanner } from "@/components/canvas/canvas-clutter-banner";
import { FrameRenameDialog } from "@/components/canvas/frame-rename-dialog";
import { ConnectionTypePrompt } from "@/components/canvas/connection-type-prompt";
import { NodeDetailPanel } from "@/components/canvas/node-detail-panel";
import { AiSuggestionsPanel } from "@/components/canvas/ai-suggestions-panel";
import { MultiSelectionPanel } from "@/components/canvas/multi-selection-panel";
import {
  useCanvas,
  useCanvasFrames,
  useCreateEdge,
  useCreateFrame,
  useDeleteFrame,
  useUpdateEdge,
  useUpdateFrame,
} from "@/hooks/use-canvas";
import { getDraggedInsightIds, resolveCanvasGroupingPlan } from "@/lib/canvas-interactions";
import type { CanvasLayoutDirection, FrameBoundsRect } from "@/lib/canvas-layout";
import { createTheme, moveThemeToGroup, updateTheme } from "@/lib/actions/consultation-workflow";
import { suggestGroupLabel } from "@/lib/actions/canvas-ai";
import {
  CANVAS_CLUTTER_THRESHOLD,
  DEFAULT_FRAME_COLOR,
  defaultFilterState,
  type CanvasFilterState,
  type ConnectionType,
  type FrameColor,
} from "@/types/canvas";
import {
  frameContainingPoint,
  nodeIdsInsideFrame,
  reconcileNodeFrameMembership,
} from "@/lib/canvas-frame-spatial";

interface CanvasShellProps {
  roundId: string;
  roundLabel: string;
}

interface ConnectionPromptState {
  edgeId: string;
  sourceLabel: string;
  targetLabel: string;
  currentType: ConnectionType;
  note: string;
  position: { x: number; y: number } | null;
}

function equalStringSets(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const bSet = new Set(b);
  return a.every((item) => bSet.has(item));
}

export function CanvasShell({ roundId, roundLabel }: CanvasShellProps) {
  const queryClient = useQueryClient();
  const canvasQuery = useCanvas(roundId);
  const createEdge = useCreateEdge(roundId);
  const updateEdge = useUpdateEdge(roundId);

  const framesQuery = useCanvasFrames(roundId);
  const createFrame = useCreateFrame(roundId);
  const updateFrame = useUpdateFrame(roundId);
  const deleteFrame = useDeleteFrame(roundId);

  const [filters, setFilters] = useState<CanvasFilterState>(defaultFilterState);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [connectionPrompt, setConnectionPrompt] = useState<ConnectionPromptState | null>(null);
  const [isGrouping, setIsGrouping] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReorganising, setIsReorganising] = useState(false);
  const [layoutRequest, setLayoutRequest] = useState<{
    id: number;
    nodeIds: string[];
    direction: CanvasLayoutDirection;
    frameBounds?: FrameBoundsRect;
  } | null>(null);
  const nextLayoutRequestIdRef = useRef(1);
  const organiseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track which theme group IDs were titled by AI so cards can show the indicator
  const [aiGeneratedGroupIds, setAiGeneratedGroupIds] = useState<Set<string>>(new Set());

  // Frame state
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null);
  const [viewportRequest, setViewportRequest] = useState<{
    id: number;
    viewport: { x: number; y: number; zoom: number };
  } | null>(null);
  const nextViewportRequestIdRef = useRef(1);
  const [clutterDismissed, setClutterDismissed] = useState(false);

  const nodes = useMemo(() => canvasQuery.data?.nodes ?? [], [canvasQuery.data?.nodes]);
  const edges = useMemo(() => canvasQuery.data?.edges ?? [], [canvasQuery.data?.edges]);

  const frames = useMemo(() => framesQuery.data ?? [], [framesQuery.data]);
  const activeFrame = useMemo(
    () => (activeFrameId ? frames.find((f) => f.id === activeFrameId) ?? null : null),
    [activeFrameId, frames]
  );
  const visibleNodeIds = useMemo(
    () =>
      activeFrame && activeFrame.node_ids.length > 0
        ? new Set(activeFrame.node_ids)
        : null,
    [activeFrame]
  );

  const showClutterBanner =
    !clutterDismissed &&
    activeFrameId === null &&
    nodes.length >= CANVAS_CLUTTER_THRESHOLD;

  const selectedNode = focusedNodeId
    ? nodes.find((node) => node.id === focusedNodeId) ?? null
    : null;
  const selectedEdge = selectedEdgeId
    ? edges.find((edge) => edge.id === selectedEdgeId) ?? null
    : null;

  // Multi-selection panel: 2+ nodes selected takes priority over single-node detail
  const selectedInsightNodes = useMemo(
    () => nodes.filter((n) => selectedNodeIds.includes(n.id) && n.type === "insight"),
    [nodes, selectedNodeIds]
  );
  const showMultiSelect = selectedNodeIds.length >= 2 && !showSuggestions;
  const hasSidePanel = Boolean(
    showSuggestions || showMultiSelect || selectedNode || selectedEdge
  );

  const nodeLabelsById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node.label] as const)),
    [nodes]
  );
  const nodePositionsById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node.position] as const)),
    [nodes]
  );
  // When a frame is active and no manual selection, scope to the frame.
  // Manual selection (≥2 nodes) always wins over frame-scope.
  const isFrameScoped = !!activeFrame && selectedNodeIds.length < 2;
  // Arrange button enabled when there are enough nodes *in scope* to layout.
  // When frame-scoped, check frame.node_ids count — not the total canvas count.
  // This prevents the button from appearing active when the frame is empty,
  // which previously led to the confusing "global arrange" fallback.
  const canReorganiseCanvas = isFrameScoped
    ? (activeFrame?.node_ids.length ?? 0) >= 2
    : nodes.length >= 2;
  const organiseLabel = isFrameScoped
    ? `Arrange "${activeFrame.name}"`
    : selectedNodeIds.length >= 2
      ? "Arrange selection"
      : "Arrange canvas";
  const organiseScopeLabel = isFrameScoped
    ? `Reflow nodes within "${activeFrame.name}"`
    : selectedNodeIds.length >= 2
      ? "Reflow the selected cluster"
      : "Reflow the main canvas map";
  // Direction recommendation based on frame aspect ratio.
  // Wide frames → prefer horizontal; tall frames → prefer vertical.
  const preferredDirections = useMemo<CanvasLayoutDirection[] | undefined>(() => {
    if (!isFrameScoped || !activeFrame) return undefined;
    const ar = activeFrame.width / activeFrame.height;
    if (ar >= 1.2) return ["LR", "RL", "TB", "BT"];
    if (ar <= 0.83) return ["TB", "BT", "LR", "RL"];
    return undefined;
  }, [isFrameScoped, activeFrame]);

  const invalidateCanvas = () =>
    queryClient.invalidateQueries({ queryKey: ["canvas", roundId] });

  // Track canvas entry for value attribution
  useEffect(() => {
    posthog.capture("canvas_opened", { round_id: roundId });
  }, [roundId]);

  useEffect(
    () => () => {
      if (organiseTimeoutRef.current) {
        clearTimeout(organiseTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      let selectedFrameId = activeFrameId;
      if (
        !selectedFrameId &&
        selectedNodeIds.length === 1 &&
        selectedNodeIds[0].startsWith("frame:")
      ) {
        selectedFrameId = selectedNodeIds[0].slice("frame:".length);
      }

      if (!selectedFrameId) {
        return;
      }

      event.preventDefault();
      void handleDeleteFrame(selectedFrameId);
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [activeFrameId, selectedNodeIds]);

  // Stable — prevents ReactFlow from rebuilding its selection handler on every render
  const handleCanvasSelectionChange = useCallback((nextIds: string[]) => {
    setSelectedNodeIds((current) =>
      equalStringSets(current, nextIds) ? current : nextIds
    );
  }, []);

  const requestReorganise = useCallback((direction: CanvasLayoutDirection) => {
    if (!canReorganiseCanvas || isReorganising) {
      return;
    }

    if (organiseTimeoutRef.current) {
      clearTimeout(organiseTimeoutRef.current);
    }

    setShowSuggestions(false);
    setSelectedEdgeId(null);
    setConnectionPrompt(null);

    // When a frame is active and the user hasn't manually selected nodes,
    // scope the layout to that frame's node_ids and pass the frame bounds so
    // the layout algorithm centers the result within the frame.
    const useFrameScope = !!activeFrame && selectedNodeIds.length < 2;

    // Guard: frame has fewer than 2 nodes — layout can't run and passing an
    // empty nodeIds array would silently fall back to scope="all" and rearrange
    // the *entire* canvas. Surface a clear error instead.
    if (useFrameScope && activeFrame.node_ids.length < 2) {
      toast.error(
        activeFrame.node_ids.length === 0
          ? `"${activeFrame.name}" has no nodes. Drag nodes inside the frame first.`
          : `"${activeFrame.name}" needs at least 2 nodes to arrange.`
      );
      return;
    }

    setIsReorganising(true);
    setLayoutRequest({
      id: nextLayoutRequestIdRef.current++,
      nodeIds: useFrameScope
        ? activeFrame.node_ids
        : selectedNodeIds.length >= 2
          ? selectedNodeIds
          : [],
      direction,
      frameBounds: useFrameScope
        ? { x: activeFrame.x, y: activeFrame.y, width: activeFrame.width, height: activeFrame.height }
        : undefined,
    });
    organiseTimeoutRef.current = setTimeout(() => {
      setIsReorganising(false);
      setLayoutRequest(null);
      toast.error("Canvas organise took too long. Try again.");
    }, 4000);
  }, [canReorganiseCanvas, isReorganising, selectedNodeIds, activeFrame]);

  const handleLayoutComplete = useCallback((result: {
    applied: boolean;
    movedNodeIds: string[];
    scope: "selected" | "all";
    direction: CanvasLayoutDirection;
    suggestedFrameBounds?: FrameBoundsRect;
  }) => {
    if (organiseTimeoutRef.current) {
      clearTimeout(organiseTimeoutRef.current);
      organiseTimeoutRef.current = null;
    }

    setIsReorganising(false);
    setLayoutRequest(null);

    if (!result.applied) {
      toast.error(
        result.scope === "selected"
          ? "Select 2 top-level nodes or clear the selection to organise the full canvas."
          : "Need at least 2 top-level nodes to organise the canvas."
      );
      return;
    }

    // If the laid-out nodes overflowed the frame bounds, auto-expand the frame.
    if (result.suggestedFrameBounds && activeFrame) {
      void updateFrame.mutateAsync({
        id: activeFrame.id,
        x: result.suggestedFrameBounds.x,
        y: result.suggestedFrameBounds.y,
        width: result.suggestedFrameBounds.width,
        height: result.suggestedFrameBounds.height,
      });
    }

    posthog.capture("canvas_reorganised", {
      round_id: roundId,
      scope: result.scope,
      direction: result.direction,
      moved_node_count: result.movedNodeIds.length,
      frame_scoped: !!activeFrame,
    });
  }, [roundId, activeFrame, updateFrame]);

  const toolbarOrganiseControl = (
    <CanvasOrganiseMenu
      disabled={!canReorganiseCanvas}
      isOrganising={isReorganising}
      label={organiseLabel}
      scopeLabel={organiseScopeLabel}
      preferredDirections={preferredDirections}
      onSelect={requestReorganise}
    />
  );

  const panelOrganiseControl = (
    <CanvasOrganiseMenu
      disabled={!canReorganiseCanvas}
      fullWidth
      isOrganising={isReorganising}
      label="Arrange selection"
      scopeLabel="Choose how the selected thread should grow"
      onSelect={requestReorganise}
    />
  );

  function handleClose() {
    setFocusedNodeId(null);
    setSelectedEdgeId(null);
    setConnectionPrompt(null);
  }

  async function handleCreateEdge(edge: Parameters<typeof createEdge.mutateAsync>[0]) {
    const createdEdge = await createEdge.mutateAsync({
      source_node_type: edge.source_node_type,
      source_node_id: edge.source_node_id,
      target_node_type: edge.target_node_type,
      target_node_id: edge.target_node_id,
      connection_type: edge.connection_type,
      note: edge.note,
    });

    setConnectionPrompt({
      edgeId: createdEdge.id,
      sourceLabel: nodeLabelsById.get(createdEdge.source_node_id) ?? "Source",
      targetLabel: nodeLabelsById.get(createdEdge.target_node_id) ?? "Target",
      currentType: createdEdge.connection_type,
      note: createdEdge.note ?? "",
      position: (() => {
        const source = nodePositionsById.get(createdEdge.source_node_id);
        const target = nodePositionsById.get(createdEdge.target_node_id);
        if (!source || !target) return null;
        return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
      })(),
    });

    return createdEdge;
  }

  async function handleSelectConnectionType(payload: { type: ConnectionType; note: string }) {
    if (!connectionPrompt) return;
    await updateEdge.mutateAsync({
      id: connectionPrompt.edgeId,
      connection_type: payload.type,
      note: payload.note.trim() || null,
    });
    setConnectionPrompt(null);
  }

  // ─── Multi-select: group selected insights into a theme ─────────────────────

  async function handleGroupSelected() {
    const insightIds = selectedInsightNodes.map((n) => n.id);
    if (insightIds.length < 2) return;

    setIsGrouping(true);
    try {
      const { groupId } = await createTheme(roundId, insightIds);

      // Ask AI to name the group from the insight labels/descriptions
      const aiLabel = await suggestGroupLabel(
        selectedInsightNodes.map((n) => n.label),
        selectedInsightNodes.map((n) => n.description ?? null)
      );
      if (aiLabel) {
        await updateTheme(groupId, { label: aiLabel });
        setAiGeneratedGroupIds((prev) => new Set([...prev, groupId]));
      }

      void invalidateCanvas();
      setSelectedNodeIds([]);
      setFocusedNodeId(null);
    } finally {
      setIsGrouping(false);
    }
  }

  // ─── Multi-select: connect selected nodes in a chain ────────────────────────

  async function handleConnectSelected() {
    const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
    if (selectedNodes.length < 2) return;

    setIsConnecting(true);
    try {
      for (let i = 0; i < selectedNodes.length - 1; i++) {
        const source = selectedNodes[i];
        const target = selectedNodes[i + 1];
        await createEdge.mutateAsync({
          source_node_type: source.type,
          source_node_id: source.id,
          target_node_type: target.type,
          target_node_id: target.id,
          connection_type: "related_to",
        });
      }
      void invalidateCanvas();
      setSelectedNodeIds([]);
      setFocusedNodeId(null);
    } finally {
      setIsConnecting(false);
    }
  }

  // ─── Drag-and-drop grouping ──────────────────────────────────────────────────

  async function handleGroupDrop(params: {
    activeNodeId: string;
    targetNodeId: string | null;
    targetGroupId?: string | null;
    insertionIndex?: number;
  }) {
    if (!canvasQuery.data) return;
    try {
      if (!params.targetNodeId) {
        const activeNode = canvasQuery.data.nodes.find((node) => node.id === params.activeNodeId);
        if (!activeNode || activeNode.type !== "insight" || !activeNode.groupId) return;

        const selectedInsightIds = selectedNodeIds.filter((id) =>
          canvasQuery.data?.nodes.some((node) => node.id === id && node.type === "insight")
        );
        const insightIds = selectedInsightIds.includes(params.activeNodeId)
          ? selectedInsightIds
          : [params.activeNodeId];

        await Promise.all(insightIds.map((insightId) => moveThemeToGroup(insightId, null)));
        void invalidateCanvas();
        setSelectedNodeIds([]);
        setFocusedNodeId(null);
        return;
      }

      const plan = resolveCanvasGroupingPlan({
        activeNodeId: params.activeNodeId,
        targetNodeId: params.targetNodeId,
        selectedNodeIds,
        nodes: canvasQuery.data.nodes,
      });

      const draggedInsightIds = getDraggedInsightIds({
        activeNodeId: params.activeNodeId,
        selectedNodeIds,
        nodes: canvasQuery.data.nodes,
      });

      if (
        params.targetGroupId &&
        typeof params.insertionIndex === "number" &&
        draggedInsightIds.length > 0
      ) {
        for (const [offset, insightId] of draggedInsightIds.entries()) {
          await moveThemeToGroup(
            insightId,
            params.targetGroupId,
            params.insertionIndex + offset
          );
        }

        void invalidateCanvas();
        setSelectedNodeIds([]);
        setFocusedNodeId(null);
        return;
      }

      if (plan.type === "noop") return;

      if (plan.type === "create-group") {
        await createTheme(roundId, plan.seedInsightIds);
      } else {
        for (const [index, insightId] of plan.insightIds.entries()) {
          await moveThemeToGroup(
            insightId,
            plan.targetGroupId,
            typeof params.insertionIndex === "number"
              ? params.insertionIndex + index
              : undefined
          );
        }
      }

      void invalidateCanvas();
      setSelectedNodeIds([]);
      setFocusedNodeId(null);
    } catch (error) {
      console.error("[canvas-shell] failed to update grouping", error);
      toast.error("Failed to update grouping.");
    }
  }

  // ─── Frame handlers ──────────────────────────────────────────────────────────

  // Drawing mode UI state. Toggled by toolbar button; consumed by CanvasGraph
  // to enable the rubber-band rectangle gesture.
  const [frameDrawingMode, setFrameDrawingMode] = useState(false);
  // Frame highlighted as drop target while a node is dragged over it.
  const [dropTargetFrameId, setDropTargetFrameId] = useState<string | null>(null);

  // Image export state (toolbar button → captureCanvasImages + download).
  const [isExportingImages, setIsExportingImages] = useState(false);
  // Rename dialog state — replaces the window.prompt() that broke design
  // consistency. Tracks the frame currently being renamed.
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);

  // Cancel drawing mode on Escape.
  useEffect(() => {
    if (!frameDrawingMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFrameDrawingMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [frameDrawingMode]);

  function handleSelectFrame(frameId: string | null) {
    setActiveFrameId(frameId);
    // Only clear selection/focus for nodes that are no longer visible in the
    // new frame. Wiping everything on every tab switch surprises users who
    // are working with a node and switch frames to check context.
    if (frameId) {
      const frame = frames.find((f) => f.id === frameId);
      if (frame) {
        const frameNodeSet = new Set(frame.node_ids);
        setSelectedNodeIds((current) => current.filter((id) => frameNodeSet.has(id)));
        setFocusedNodeId((current) => (current && frameNodeSet.has(current) ? current : null));
      }
    }
    // Switching back to "All" — keep whatever selection the user has.
  }

  /**
   * Drawing-mode entry. Called when the consultant releases a rubber-band
   * rectangle on the canvas. Auto-assigns nodes whose centres fall inside
   * the drawn bounds and exits drawing mode.
   */
  async function handleFrameDraw(bounds: { x: number; y: number; width: number; height: number }) {
    const currentViewport = canvasQuery.data?.viewport ?? { x: 0, y: 0, zoom: 1 };
    const auto = nodeIdsInsideFrame(nodes, bounds);
    const name = `Frame ${frames.length + 1}`;
    const frame = await createFrame.mutateAsync({
      name,
      node_ids: auto,
      viewport: currentViewport,
      ...bounds,
      color: DEFAULT_FRAME_COLOR,
    });
    setActiveFrameId(frame.id);
    setFrameDrawingMode(false);
  }

  /**
   * Persist new bounds after frame drag/resize and recompute membership.
   * Nodes inside the new bounds are added; previously-included nodes that
   * are now outside are dropped.
   */
  async function handleFramePersist(
    frameId: string,
    bounds: { x: number; y: number; width: number; height: number }
  ) {
    const nextNodeIds = nodeIdsInsideFrame(nodes, bounds);
    await updateFrame.mutateAsync({
      id: frameId,
      ...bounds,
      node_ids: nextNodeIds,
    });
  }

  /**
   * Recompute frame membership for a node that just finished dragging.
   * Adds the node to the frame whose bounds contain its new position; removes
   * it from any frame it was previously a member of.
   */
  async function handleNodeFrameAssign(nodeId: string, position: { x: number; y: number }) {
    setDropTargetFrameId(null);
    const { assignTo, removeFrom } = reconcileNodeFrameMembership(nodeId, position, frames);
    const ops: Promise<unknown>[] = [];
    if (assignTo && !assignTo.node_ids.includes(nodeId)) {
      ops.push(
        updateFrame.mutateAsync({
          id: assignTo.id,
          node_ids: [...assignTo.node_ids, nodeId],
        })
      );
    }
    for (const frame of removeFrom) {
      ops.push(
        updateFrame.mutateAsync({
          id: frame.id,
          node_ids: frame.node_ids.filter((id) => id !== nodeId),
        })
      );
    }
    if (ops.length > 0) await Promise.all(ops);
  }

  function handleNodeFrameDragOver(_nodeId: string, position: { x: number; y: number }) {
    const target = frameContainingPoint(frames, position);
    setDropTargetFrameId(target?.id ?? null);
  }

  /** Frame-bar/header rename trigger — opens the rename dialog. */
  function handleFrameRename(frameId: string) {
    setRenameTargetId(frameId);
  }

  /** Frame-bar inline rename (double-click on tab) — direct write. */
  async function handleRenameFrame(frameId: string, name: string) {
    await updateFrame.mutateAsync({ id: frameId, name });
  }

  /** Submit handler for the FrameRenameDialog. */
  async function handleRenameDialogSubmit(name: string) {
    if (!renameTargetId) return;
    await updateFrame.mutateAsync({ id: renameTargetId, name });
  }

  async function handleFrameColorChange(frameId: string, color: FrameColor) {
    await updateFrame.mutateAsync({ id: frameId, color });
  }

  const handleDeleteFrame = useCallback(
    async (frameId: string) => {
      try {
        await deleteFrame.mutateAsync(frameId);
        if (activeFrameId === frameId) setActiveFrameId(null);
        const frameFlowId = `frame:${frameId}`;
        setSelectedNodeIds((current) => current.filter((id) => id !== frameFlowId));
        if (focusedNodeId === frameFlowId) setFocusedNodeId(null);
      } catch (error) {
        throw error;
      }
    },
    [activeFrameId, deleteFrame, focusedNodeId, selectedNodeIds]
  );

  /**
   * Export the current canvas + per-frame images. Captures the live ReactFlow
   * DOM via html2canvas, crops per-frame using ReactFlow viewport transform,
   * then triggers sequential downloads. Implemented in lib/canvas-snapshot.ts.
   */
  async function handleExportImages() {
    if (isExportingImages) return;
    setIsExportingImages(true);
    try {
      const { downloadCanvasImages } = await import("@/lib/canvas-snapshot");
      await downloadCanvasImages({
        roundId,
        frames,
        edges,
      });
    } catch (error) {
      console.error("[canvas-shell] export images failed", error);
      toast.error("Failed to export images.");
    } finally {
      setIsExportingImages(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="sm" asChild className="-ml-1 gap-1 text-muted-foreground hover:text-foreground">
          <Link href={`/consultations/rounds/${roundId}`} aria-label="Back to Consultation">
            <ChevronLeft className="h-4 w-4" />
            <span>Back to Consultation</span>
          </Link>
        </Button>
        <Separator orientation="vertical" className="h-4" />
        <span className="text-sm font-medium text-muted-foreground">{roundLabel}</span>
        <Separator orientation="vertical" className="h-4" />

        <div className="flex items-center gap-2">
          <ToolbarFilterBadge
            label="Theme groups"
            active={filters.nodeTypes.includes("theme")}
            onClick={() =>
              setFilters((current) => ({
                ...current,
                nodeTypes: current.nodeTypes.includes("theme")
                  ? current.nodeTypes.filter((type) => type !== "theme")
                  : [...current.nodeTypes, "theme"],
              }))
            }
          />
          <ToolbarFilterBadge
            label="Insights"
            active={filters.nodeTypes.includes("insight")}
            onClick={() =>
              setFilters((current) => ({
                ...current,
                nodeTypes: current.nodeTypes.includes("insight")
                  ? current.nodeTypes.filter((type) => type !== "insight")
                  : [...current.nodeTypes, "insight"],
              }))
            }
          />
          <ToolbarFilterBadge
            label="Accepted only"
            active={filters.acceptedOnly}
            onClick={() =>
              setFilters((current) => ({ ...current, acceptedOnly: !current.acceptedOnly }))
            }
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {toolbarOrganiseControl}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowSuggestions((value) => !value);
              setFocusedNodeId(null);
              setSelectedEdgeId(null);
            }}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            AI suggestions
          </Button>
          <span className="text-xs text-muted-foreground">
            Drag to box-select or Shift+click to multi-select
          </span>
        </div>
      </div>

      {/* Frame bar — hosts both tab selection and the Draw / Export actions
          so the top toolbar can stay focused on filters + AI controls. */}
      <CanvasFrameBar
        frames={frames}
        activeFrameId={activeFrameId}
        drawingMode={frameDrawingMode}
        exporting={isExportingImages}
        onSelectFrame={handleSelectFrame}
        onRenameFrame={handleRenameFrame}
        onDeleteFrame={handleDeleteFrame}
        onToggleDrawingMode={() => setFrameDrawingMode((v) => !v)}
        onExportImages={handleExportImages}
      />

      {/* Clutter banner — points consultants at drawing mode rather than the
          old default-spot create flow. */}
      {showClutterBanner && (
        <CanvasClutterBanner
          nodeCount={nodes.length}
          onCreateFrame={() => {
            setClutterDismissed(true);
            setFrameDrawingMode(true);
          }}
          onDismiss={() => setClutterDismissed(true)}
        />
      )}

      {/* Canvas + side panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1 bg-muted/30">
          {/* Edge editing via onEdgeSelect → NodeDetailPanel (panel-based flow).
              Removed onQuickEditEdge prop for performance. */}
          <CanvasGraph
            roundId={roundId}
            filters={filters}
            selectedNodeIds={selectedNodeIds}
            selectedEdgeId={selectedEdgeId}
            aiGeneratedGroupIds={aiGeneratedGroupIds}
            layoutRequest={layoutRequest}
            visibleNodeIds={visibleNodeIds}
            viewportRequest={viewportRequest}
            frames={frames}
            frameDrawingMode={frameDrawingMode}
            dropTargetFrameId={dropTargetFrameId}
            onFrameDraw={handleFrameDraw}
            onFramePersist={handleFramePersist}
            onNodeFrameAssign={handleNodeFrameAssign}
            onNodeFrameDragOver={handleNodeFrameDragOver}
            onFrameRename={handleFrameRename}
            onFrameColorChange={handleFrameColorChange}
            onSelectionChange={handleCanvasSelectionChange}
            onNodeFocus={setFocusedNodeId}
            onEdgeSelect={setSelectedEdgeId}
            onLayoutComplete={handleLayoutComplete}
            onCreateEdge={handleCreateEdge}
            onGroupDrop={handleGroupDrop}
          />

          {connectionPrompt ? (
            <ConnectionTypePrompt
              sourceLabel={connectionPrompt.sourceLabel}
              targetLabel={connectionPrompt.targetLabel}
              initialType={connectionPrompt.currentType}
              initialNote={connectionPrompt.note}
              position={connectionPrompt.position}
              onSave={handleSelectConnectionType}
              onDismiss={() => setConnectionPrompt(null)}
            />
          ) : null}
        </div>

        {hasSidePanel ? (
          <div className="w-80 shrink-0 border-l bg-background">
            {showSuggestions ? (
              <AiSuggestionsPanel
                roundId={roundId}
                nodes={nodes}
                onClose={() => setShowSuggestions(false)}
              />
            ) : showMultiSelect ? (
              <MultiSelectionPanel
                selectedNodeIds={selectedNodeIds}
                nodes={nodes}
                organiseControl={panelOrganiseControl}
                isGrouping={isGrouping}
                isConnecting={isConnecting}
                onGroup={handleGroupSelected}
                onConnect={handleConnectSelected}
                onClear={() => {
                  setSelectedNodeIds([]);
                  setFocusedNodeId(null);
                }}
              />
            ) : (
              <NodeDetailPanel
                selectedNodeId={selectedNode?.id ?? null}
                selectedEdgeId={selectedEdgeId}
                nodes={nodes}
                edges={edges}
                roundId={roundId}
                onQuickTypeSelect={(edge) =>
                  setConnectionPrompt({
                    edgeId: edge.id,
                    sourceLabel: nodeLabelsById.get(edge.source_node_id) ?? "Source",
                    targetLabel: nodeLabelsById.get(edge.target_node_id) ?? "Target",
                    currentType: edge.connection_type,
                    note: edge.note ?? "",
                    position: null,
                  })
                }
                onUngroupInsight={async (nodeId) => {
                  await moveThemeToGroup(nodeId, null);
                  await invalidateCanvas();
                  setFocusedNodeId(nodeId);
                }}
                onClose={handleClose}
              />
            )}
          </div>
        ) : null}
      </div>

      {/* Native rename dialog (replaces window.prompt). Mounted at the
          top level so it sits above the canvas in z-order. */}
      <FrameRenameDialog
        open={renameTargetId !== null}
        initialName={
          frames.find((f) => f.id === renameTargetId)?.name ?? ""
        }
        onOpenChange={(open) => {
          if (!open) setRenameTargetId(null);
        }}
        onSubmit={handleRenameDialogSubmit}
      />
    </div>
  );
}

function ToolbarFilterBadge({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Badge
      variant={active ? "default" : "outline"}
      className="cursor-pointer select-none"
      onClick={onClick}
    >
      {label}
    </Badge>
  );
}

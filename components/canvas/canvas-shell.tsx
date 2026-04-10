"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ConnectionTypePrompt } from "@/components/canvas/connection-type-prompt";
import { NodeDetailPanel } from "@/components/canvas/node-detail-panel";
import { AiSuggestionsPanel } from "@/components/canvas/ai-suggestions-panel";
import { MultiSelectionPanel } from "@/components/canvas/multi-selection-panel";
import { useCanvas, useCreateEdge, useUpdateEdge } from "@/hooks/use-canvas";
import { getDraggedInsightIds, resolveCanvasGroupingPlan } from "@/lib/canvas-interactions";
import type { CanvasLayoutDirection } from "@/lib/canvas-layout";
import { createTheme, moveThemeToGroup, updateTheme } from "@/lib/actions/consultation-workflow";
import { suggestGroupLabel } from "@/lib/actions/canvas-ai";
import { defaultFilterState, type CanvasFilterState, type ConnectionType } from "@/types/canvas";

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
  } | null>(null);
  // Track which theme group IDs were titled by AI so cards can show the indicator
  const [aiGeneratedGroupIds, setAiGeneratedGroupIds] = useState<Set<string>>(new Set());

  const nodes = useMemo(() => canvasQuery.data?.nodes ?? [], [canvasQuery.data?.nodes]);
  const edges = useMemo(() => canvasQuery.data?.edges ?? [], [canvasQuery.data?.edges]);

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
  const canReorganiseCanvas = nodes.length >= 2;
  const organiseLabel = selectedNodeIds.length >= 2 ? "Organise selected" : "Organise canvas";
  const organiseScopeLabel =
    selectedNodeIds.length >= 2
      ? "Arrange the current multi-selection"
      : "Arrange all top-level canvas nodes";

  const invalidateCanvas = () =>
    queryClient.invalidateQueries({ queryKey: ["canvas", roundId] });

  // Track canvas entry for value attribution
  useEffect(() => {
    posthog.capture("canvas_opened", { round_id: roundId });
  }, [roundId]);

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

    setShowSuggestions(false);
    setSelectedEdgeId(null);
    setConnectionPrompt(null);
    setIsReorganising(true);
    setLayoutRequest((current) => ({
      id: (current?.id ?? 0) + 1,
      nodeIds: selectedNodeIds.length >= 2 ? selectedNodeIds : [],
      direction,
    }));
  }, [canReorganiseCanvas, isReorganising, selectedNodeIds]);

  const handleLayoutComplete = useCallback((result: {
    applied: boolean;
    movedNodeIds: string[];
    scope: "selected" | "all";
    direction: CanvasLayoutDirection;
  }) => {
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

    posthog.capture("canvas_reorganised", {
      round_id: roundId,
      scope: result.scope,
      direction: result.direction,
      moved_node_count: result.movedNodeIds.length,
    });
  }, [roundId]);

  const toolbarOrganiseControl = (
    <CanvasOrganiseMenu
      disabled={!canReorganiseCanvas}
      isOrganising={isReorganising}
      label={organiseLabel}
      scopeLabel={organiseScopeLabel}
      onSelect={requestReorganise}
    />
  );

  const panelOrganiseControl = (
    <CanvasOrganiseMenu
      disabled={!canReorganiseCanvas}
      fullWidth
      isOrganising={isReorganising}
      label="Organise selected"
      scopeLabel="Choose a layout direction for the current selection"
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

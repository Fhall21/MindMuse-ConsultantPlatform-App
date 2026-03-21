"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Layers3, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CanvasGraph } from "@/components/canvas/canvas-graph";
import { ConnectionTypePrompt } from "@/components/canvas/connection-type-prompt";
import { NodeDetailPanel } from "@/components/canvas/node-detail-panel";
import { AiSuggestionsPanel } from "@/components/canvas/ai-suggestions-panel";
import { useCanvas, useCreateEdge, useUpdateEdge } from "@/hooks/use-canvas";
import { resolveCanvasGroupingPlan } from "@/lib/canvas-interactions";
import { createTheme, moveThemeToGroup } from "@/lib/actions/round-workflow";
import { defaultFilterState, type CanvasFilterState, type ConnectionType } from "@/types/canvas";

interface CanvasShellProps {
  consultationId: string;
  consultationTitle: string;
}

interface ConnectionPromptState {
  edgeId: string;
  sourceLabel: string;
  targetLabel: string;
  currentType: ConnectionType;
  note: string;
  position: { x: number; y: number } | null;
}

export function CanvasShell({ consultationId, consultationTitle }: CanvasShellProps) {
  const queryClient = useQueryClient();
  const canvasQuery = useCanvas(consultationId);
  const createEdge = useCreateEdge(consultationId);
  const updateEdge = useUpdateEdge(consultationId);

  const [filters, setFilters] = useState<CanvasFilterState>(defaultFilterState);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [connectionPrompt, setConnectionPrompt] = useState<ConnectionPromptState | null>(null);

  const nodes = useMemo(() => canvasQuery.data?.nodes ?? [], [canvasQuery.data?.nodes]);
  const edges = useMemo(() => canvasQuery.data?.edges ?? [], [canvasQuery.data?.edges]);

  const selectedNode = focusedNodeId
    ? nodes.find((node) => node.id === focusedNodeId) ?? null
    : null;
  const selectedEdge = selectedEdgeId
    ? edges.find((edge) => edge.id === selectedEdgeId) ?? null
    : null;

  const hasSidePanel = Boolean(selectedNode || selectedEdge || showSuggestions);
  const selectedInsightCount = selectedNodeIds.filter((id) =>
    nodes.some((node) => node.id === id && node.type === "insight")
  ).length;

  const nodeLabelsById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node.label] as const)),
    [nodes]
  );

  const nodePositionsById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node.position] as const)),
    [nodes]
  );

  const invalidateCanvas = () =>
    queryClient.invalidateQueries({ queryKey: ["canvas", consultationId] });

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
        if (!source || !target) {
          return null;
        }

        return {
          x: (source.x + target.x) / 2,
          y: (source.y + target.y) / 2,
        };
      })(),
    });

    return createdEdge;
  }

  async function handleSelectConnectionType(payload: {
    type: ConnectionType;
    note: string;
  }) {
    if (!connectionPrompt) {
      return;
    }

    await updateEdge.mutateAsync({
      id: connectionPrompt.edgeId,
      connection_type: payload.type,
      note: payload.note.trim() || null,
    });
    setConnectionPrompt(null);
  }

  async function handleGroupDrop(params: { activeNodeId: string; targetNodeId: string }) {
    if (!canvasQuery.data) {
      return;
    }

    const plan = resolveCanvasGroupingPlan({
      activeNodeId: params.activeNodeId,
      targetNodeId: params.targetNodeId,
      selectedNodeIds,
      nodes: canvasQuery.data.nodes,
    });

    if (plan.type === "noop") {
      return;
    }

    if (plan.type === "create-group") {
      await createTheme(canvasQuery.data.round_id, plan.seedInsightIds);
    } else {
      await Promise.all(
        plan.insightIds.map((insightId, index) =>
          moveThemeToGroup(insightId, plan.targetGroupId, index)
        )
      );
    }

    void invalidateCanvas();
    setSelectedNodeIds([]);
    setFocusedNodeId(null);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">{consultationTitle}</span>
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
          {selectedInsightCount > 1 ? (
            <Badge variant="secondary" className="gap-1">
              <Layers3 className="h-3 w-3" />
              {selectedInsightCount} insights ready to group
            </Badge>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => setShowSuggestions((value) => !value)}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            AI suggestions
          </Button>
          <span className="text-xs text-muted-foreground">Drag onto a card to group</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1 bg-muted/30">
          <CanvasGraph
            consultationId={consultationId}
            filters={filters}
            selectedNodeIds={selectedNodeIds}
            selectedEdgeId={selectedEdgeId}
            onSelectionChange={setSelectedNodeIds}
            onNodeFocus={setFocusedNodeId}
            onEdgeSelect={setSelectedEdgeId}
            onCreateEdge={handleCreateEdge}
            onQuickEditEdge={(edgeId) => {
              const edge = edges.find((item) => item.id === edgeId);
              if (!edge) {
                return;
              }
              setSelectedEdgeId(edgeId);
              setConnectionPrompt({
                edgeId,
                sourceLabel: nodeLabelsById.get(edge.source_node_id) ?? "Source",
                targetLabel: nodeLabelsById.get(edge.target_node_id) ?? "Target",
                currentType: edge.connection_type,
                note: edge.note ?? "",
                position: null,
              });
            }}
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
                consultationId={consultationId}
                nodes={nodes}
                onClose={() => setShowSuggestions(false)}
              />
            ) : (
              <NodeDetailPanel
                selectedNodeId={selectedNode?.id ?? null}
                selectedEdgeId={selectedEdgeId}
                nodes={nodes}
                edges={edges}
                consultationId={consultationId}
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

"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useDeleteEdge, useUpdateEdge } from "@/hooks/use-canvas";
import type { CanvasEdge, CanvasNode } from "@/types/canvas";

interface NodeDetailPanelProps {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  consultationId: string;
  onQuickTypeSelect: (edge: CanvasEdge) => void;
  onUngroupInsight: (nodeId: string) => Promise<void>;
  onClose: () => void;
}

export function NodeDetailPanel({
  selectedNodeId,
  selectedEdgeId,
  nodes,
  edges,
  consultationId,
  onQuickTypeSelect,
  onUngroupInsight,
  onClose,
}: NodeDetailPanelProps) {
  const selectedNode = selectedNodeId
    ? nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;
  const selectedEdge = selectedEdgeId
    ? edges.find((edge) => edge.id === selectedEdgeId) ?? null
    : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {selectedNode ? "Card details" : selectedEdge ? "Connection" : "Details"}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Close panel</span>
        </Button>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {selectedNode ? (
          <NodeInfoCard node={selectedNode} onUngroupInsight={onUngroupInsight} />
        ) : null}
        {selectedEdge ? (
          <EdgeEditForm
            key={selectedEdge.id}
            edge={selectedEdge}
            nodes={nodes}
            consultationId={consultationId}
            onQuickTypeSelect={onQuickTypeSelect}
            onDeleted={onClose}
          />
        ) : null}
      </div>
    </div>
  );
}

function NodeInfoCard({
  node,
  onUngroupInsight,
}: {
  node: CanvasNode;
  onUngroupInsight: (nodeId: string) => Promise<void>;
}) {
  const isInsight = node.type === "insight";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-medium leading-snug">{node.label}</h3>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-xs">
            {isInsight ? "Insight" : "Theme group"}
          </Badge>
          {node.sourceConsultationTitle ? (
            <Badge variant="secondary" className="text-xs">
              {node.sourceConsultationTitle}
            </Badge>
          ) : null}
          {node.accepted ? (
            <Badge variant="secondary" className="text-xs">
              Accepted
            </Badge>
          ) : null}
          {!isInsight ? (
            <Badge variant="outline" className="text-xs">
              {node.memberIds.length} insight{node.memberIds.length === 1 ? "" : "s"}
            </Badge>
          ) : null}
        </div>
      </div>

      {node.description ? (
        <>
          <Separator />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {node.description}
          </p>
        </>
      ) : null}

      <Separator />

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Drag from the visible Connect handle on a card to create a relationship.
          Dropping an insight card onto another insight creates a new group.
        </p>
        {isInsight && node.groupId ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void onUngroupInsight(node.id)}
          >
            Ungroup insight
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function EdgeEditForm({
  edge,
  nodes,
  consultationId,
  onQuickTypeSelect,
  onDeleted,
}: {
  edge: CanvasEdge;
  nodes: CanvasNode[];
  consultationId: string;
  onQuickTypeSelect: (edge: CanvasEdge) => void;
  onDeleted: () => void;
}) {
  const [note, setNote] = useState(edge.note ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateMutation = useUpdateEdge(consultationId);
  const deleteMutation = useDeleteEdge(consultationId);

  const sourceNode = nodes.find((node) => node.id === edge.source_node_id);
  const targetNode = nodes.find((node) => node.id === edge.target_node_id);
  const isBusy = updateMutation.isPending || deleteMutation.isPending;

  async function handleSaveNote() {
    await updateMutation.mutateAsync({
      id: edge.id,
      note: note.trim() || null,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="truncate font-medium text-foreground">
          {sourceNode?.label ?? "Unknown"}
        </span>
        <span className="shrink-0">→</span>
        <span className="truncate font-medium text-foreground">
          {targetNode?.label ?? "Unknown"}
        </span>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Type</p>
            <p className="text-sm font-medium">
              {edge.connection_type.replace(/_/g, " ")}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onQuickTypeSelect(edge)}
          >
            Change type
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Note</label>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value.slice(0, 500))}
          placeholder="Add a note about this connection…"
          className="min-h-[100px] resize-none text-xs"
          disabled={isBusy}
        />
        <p className="text-right text-xs text-muted-foreground">{note.length}/500</p>
      </div>

      <Button size="sm" onClick={() => void handleSaveNote()} disabled={isBusy}>
        {updateMutation.isPending ? (
          <>
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            Saving…
          </>
        ) : (
          "Save note"
        )}
      </Button>

      <Separator />

      <Button
        variant="destructive"
        size="sm"
        onClick={() => {
          if (!confirmDelete) {
            setConfirmDelete(true);
            return;
          }
          deleteMutation.mutate(edge.id, {
            onSuccess: onDeleted,
          });
        }}
        disabled={isBusy}
      >
        {deleteMutation.isPending ? (
          <>
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            Deleting…
          </>
        ) : confirmDelete ? (
          "Click again to confirm"
        ) : (
          "Delete connection"
        )}
      </Button>
    </div>
  );
}

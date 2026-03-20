"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateEdge, useDeleteEdge } from "@/hooks/use-canvas";
import type { CanvasNode, CanvasEdge, ConnectionType } from "@/types/canvas";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  causes: "Causes",
  influences: "Influences",
  supports: "Supports",
  contradicts: "Contradicts",
  related_to: "Related to",
};

const ALL_CONNECTION_TYPES: ConnectionType[] = [
  "causes",
  "influences",
  "supports",
  "contradicts",
  "related_to",
];

const NOTE_MAX_CHARS = 500;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NodeDetailPanelProps {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  consultationId: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NodeDetailPanel({
  selectedNodeId,
  selectedEdgeId,
  nodes,
  edges,
  consultationId,
  onClose,
}: NodeDetailPanelProps) {
  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId) ?? null
    : null;

  const selectedEdge = selectedEdgeId
    ? edges.find((e) => e.id === selectedEdgeId) ?? null
    : null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {selectedNode ? "Node" : selectedEdge ? "Connection" : "Detail"}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Close panel</span>
        </Button>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {selectedNode && (
          <NodeInfoCard node={selectedNode} />
        )}
        {selectedEdge && (
          <EdgeEditForm
            edge={selectedEdge}
            nodes={nodes}
            consultationId={consultationId}
            onDeleted={onClose}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Node info card
// ---------------------------------------------------------------------------

function NodeInfoCard({ node }: { node: CanvasNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-medium leading-snug">{node.label}</h3>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-xs">
            {node.type === "theme" ? "Theme" : "Insight"}
          </Badge>
          {node.accepted && (
            <Badge variant="secondary" className="text-xs">
              Accepted
            </Badge>
          )}
          {node.subgroup && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {node.subgroup}
            </Badge>
          )}
        </div>
      </div>

      {node.description && (
        <>
          <Separator />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {node.description}
          </p>
        </>
      )}

      <Separator />

      <p className="text-xs text-muted-foreground">
        To connect this node to another, drag from its handle to the target node
        on the canvas.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edge edit form
// ---------------------------------------------------------------------------

interface EdgeEditFormProps {
  edge: CanvasEdge;
  nodes: CanvasNode[];
  consultationId: string;
  onDeleted: () => void;
}

function EdgeEditForm({ edge, nodes, consultationId, onDeleted }: EdgeEditFormProps) {
  const [connectionType, setConnectionType] = useState<ConnectionType>(
    edge.connection_type
  );
  const [note, setNote] = useState<string>(edge.note ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateMutation = useUpdateEdge(consultationId);
  const deleteMutation = useDeleteEdge(consultationId);

  // Reset form when a different edge is selected
  useEffect(() => {
    setConnectionType(edge.connection_type);
    setNote(edge.note ?? "");
    setConfirmDelete(false);
  }, [edge.id, edge.connection_type, edge.note]);

  const sourceNode = nodes.find((n) => n.id === edge.source_node_id);
  const targetNode = nodes.find((n) => n.id === edge.target_node_id);

  function handleSave() {
    updateMutation.mutate({
      id: edge.id,
      connection_type: connectionType,
      note: note.trim() || null,
    });
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteMutation.mutate(edge.id, {
      onSuccess: onDeleted,
    });
  }

  const isSaving = updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const isBusy = isSaving || isDeleting;

  return (
    <div className="flex flex-col gap-4">
      {/* From → To row */}
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

      {/* Connection type */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">Connection type</label>
        <Select
          value={connectionType}
          onValueChange={(v: string) => setConnectionType(v as ConnectionType)}
          disabled={isBusy}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_CONNECTION_TYPES.map((type) => (
              <SelectItem key={type} value={type} className="text-xs">
                {CONNECTION_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Note */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">Note</label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX_CHARS))}
          placeholder="Add a note about this connection…"
          className="min-h-[80px] resize-none text-xs"
          disabled={isBusy}
        />
        <p className="text-right text-xs text-muted-foreground">
          {note.length}/{NOTE_MAX_CHARS}
        </p>
      </div>

      {/* Save */}
      <Button
        size="sm"
        onClick={handleSave}
        disabled={isBusy}
        className="w-full"
      >
        {isSaving ? (
          <>
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            Saving…
          </>
        ) : (
          "Save"
        )}
      </Button>

      <Separator />

      {/* Delete */}
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        disabled={isBusy}
        className="w-full"
      >
        {isDeleting ? (
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

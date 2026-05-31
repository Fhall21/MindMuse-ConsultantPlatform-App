"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Save, Trash2, Unlink, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useDeleteEdge, useUpdateEdge } from "@/hooks/use-canvas";
import type { CanvasEdge, CanvasNode } from "@/types/canvas";

interface NodeDetailPanelProps {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  roundId: string;
  onQuickTypeSelect: (edge: CanvasEdge) => void;
  onUngroupInsight: (nodeId: string) => Promise<void>;
  onSaveThemeGroup: (
    groupId: string,
    patch: { label: string; description: string | null }
  ) => Promise<boolean>;
  onDeleteThemeGroup: (groupId: string) => Promise<boolean>;
  onClose: () => void;
}

export function NodeDetailPanel({
  selectedNodeId,
  selectedEdgeId,
  nodes,
  edges,
  roundId,
  onQuickTypeSelect,
  onUngroupInsight,
  onSaveThemeGroup,
  onDeleteThemeGroup,
  onClose,
}: NodeDetailPanelProps) {
  const selectedNode = selectedNodeId
    ? nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;
  const selectedEdge = selectedEdgeId
    ? edges.find((edge) => edge.id === selectedEdgeId) ?? null
    : null;
  const isThemeNode = selectedNode?.type === "theme";

  const [draftLabel, setDraftLabel] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [editingField, setEditingField] = useState<"label" | "description" | null>(null);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [isDeletingTheme, setIsDeletingTheme] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isThemeNode && selectedNode) {
      setDraftLabel(selectedNode.label);
      setDraftDescription(selectedNode.description ?? "");
    } else {
      setDraftLabel("");
      setDraftDescription("");
    }
    setEditingField(null);
    setConfirmDelete(false);
  }, [isThemeNode, selectedNode?.description, selectedNode?.id, selectedNode?.label]);

  const themeChildren = useMemo(() => {
    if (!isThemeNode || !selectedNode) {
      return [];
    }

    const nodeById = new Map(nodes.map((node) => [node.id, node] as const));

    return selectedNode.memberIds
      .map((memberId) => nodeById.get(memberId))
      .filter((node): node is CanvasNode => Boolean(node) && node.type === "insight");
  }, [isThemeNode, nodes, selectedNode]);

  const hasThemeChanges =
    isThemeNode &&
    selectedNode
      ? draftLabel.trim() !== selectedNode.label ||
        draftDescription.trim() !== (selectedNode.description ?? "")
      : false;

  async function handleSaveThemeGroup() {
    if (!selectedNode || selectedNode.type !== "theme") {
      return false;
    }

    const nextLabel = draftLabel.trim();
    if (!nextLabel) {
      return false;
    }

    setIsSavingTheme(true);
    try {
      const saved = await onSaveThemeGroup(selectedNode.id, {
        label: nextLabel,
        description: draftDescription.trim() || null,
      });
      if (saved) {
        setEditingField(null);
        setConfirmDelete(false);
      }
      return saved;
    } finally {
      setIsSavingTheme(false);
    }
  }

  async function handleDeleteThemeGroup() {
    if (!selectedNode || selectedNode.type !== "theme") {
      return false;
    }

    if (!confirmDelete) {
      setConfirmDelete(true);
      return false;
    }

    setIsDeletingTheme(true);
    try {
      return await onDeleteThemeGroup(selectedNode.id);
    } finally {
      setIsDeletingTheme(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {isThemeNode ? "Theme group" : selectedNode ? "Card details" : selectedEdge ? "Connection" : "Details"}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Close panel</span>
        </Button>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isThemeNode && selectedNode ? (
          <ThemeGroupEditor
            node={selectedNode}
            draftLabel={draftLabel}
            draftDescription={draftDescription}
            editingField={editingField}
            themeChildren={themeChildren}
            hasThemeChanges={hasThemeChanges}
            isSavingTheme={isSavingTheme}
            isDeletingTheme={isDeletingTheme}
            confirmDelete={confirmDelete}
            onChangeLabel={setDraftLabel}
            onChangeDescription={setDraftDescription}
            onEditField={setEditingField}
            onSave={handleSaveThemeGroup}
            onDelete={handleDeleteThemeGroup}
          />
        ) : selectedNode ? (
          <NodeInfoCard node={selectedNode} onUngroupInsight={onUngroupInsight} />
        ) : null}
        {selectedEdge ? (
          <EdgeEditForm
            key={selectedEdge.id}
            edge={selectedEdge}
            nodes={nodes}
            roundId={roundId}
            onQuickTypeSelect={onQuickTypeSelect}
            onDeleted={onClose}
          />
        ) : null}
      </div>
    </div>
  );
}

function ThemeGroupEditor({
  node,
  draftLabel,
  draftDescription,
  editingField,
  themeChildren,
  hasThemeChanges,
  isSavingTheme,
  isDeletingTheme,
  confirmDelete,
  onChangeLabel,
  onChangeDescription,
  onEditField,
  onSave,
  onDelete,
}: {
  node: CanvasNode;
  draftLabel: string;
  draftDescription: string;
  editingField: "label" | "description" | null;
  themeChildren: CanvasNode[];
  hasThemeChanges: boolean;
  isSavingTheme: boolean;
  isDeletingTheme: boolean;
  confirmDelete: boolean;
  onChangeLabel: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onEditField: (field: "label" | "description" | null) => void;
  onSave: () => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}) {
  const childCount = node.memberIds.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Title */}
      <EditableThemeField
        label="Title"
        value={draftLabel}
        editing={editingField === "label"}
        onEdit={() => onEditField("label")}
        onChange={onChangeLabel}
        placeholder="Add a theme title"
        minHeightClassName="min-h-[2.75rem]"
      />

      {/* Description */}
      <EditableThemeField
        label="Description"
        value={draftDescription}
        editing={editingField === "description"}
        multiline
        onEdit={() => onEditField("description")}
        onChange={onChangeDescription}
        placeholder="Add a short description"
        minHeightClassName="min-h-[6.5rem]"
      />

      <Separator />

      {/* Insights list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Insights
          </p>
          <span className="text-[10px] text-muted-foreground">
            {childCount} total
          </span>
        </div>

        {themeChildren.length > 0 ? (
          <div className="space-y-1">
            {themeChildren.map((child) => (
              <div
                key={child.id}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 bg-muted/40"
              >
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/60" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm leading-snug text-foreground">{child.label}</p>
                  {(child.description ?? child.sourceConsultationTitle) ? (
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {child.description ?? child.sourceConsultationTitle}
                    </p>
                  ) : null}
                </div>
                {child.accepted ? (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    Accepted
                  </Badge>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            No insights linked to this group yet.
          </p>
        )}
      </div>

      <Separator />

      {/* Actions */}
      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Actions
        </p>

        <Button
          variant="default"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => void onSave()}
          disabled={!hasThemeChanges || isSavingTheme || isDeletingTheme || draftLabel.trim().length === 0}
        >
          {isSavingTheme ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {isSavingTheme ? "Saving…" : "Save changes"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className={cn(
            "w-full justify-start gap-2",
            confirmDelete && "border-destructive/60 text-destructive hover:bg-destructive/10 hover:text-destructive"
          )}
          onClick={() => void onDelete()}
          disabled={isSavingTheme || isDeletingTheme}
        >
          {isDeletingTheme ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          {isDeletingTheme ? "Deleting…" : confirmDelete ? "Confirm delete" : "Delete group"}
        </Button>

        {confirmDelete && (
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Group shell removed. Insight cards stay on canvas.
          </p>
        )}
      </div>
    </div>
  );
}

function EditableThemeField({
  label,
  value,
  editing,
  multiline = false,
  onEdit,
  onChange,
  placeholder,
  minHeightClassName,
}: {
  label: string;
  value: string;
  editing: boolean;
  multiline?: boolean;
  onEdit: () => void;
  onChange: (value: string) => void;
  placeholder: string;
  minHeightClassName: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {!editing && (
          <button
            type="button"
            onClick={onEdit}
            className="rounded p-0.5 text-muted-foreground/60 transition hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
            aria-label={`Edit ${label}`}
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>

      {editing ? (
        multiline ? (
          <Textarea
            autoFocus
            value={value}
            onChange={(event) => onChange(event.target.value.slice(0, 1200))}
            placeholder={placeholder}
            className={`${minHeightClassName} resize-none text-sm leading-relaxed`}
          />
        ) : (
          <Input
            autoFocus
            value={value}
            onChange={(event) => onChange(event.target.value.slice(0, 120))}
            placeholder={placeholder}
            className="h-11 text-sm"
          />
        )
      ) : (
        <button
          type="button"
          onClick={onEdit}
          className="block w-full rounded-sm text-left outline-none transition hover:opacity-75 focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {value ? (
            multiline ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {value}
              </p>
            ) : (
              <p className="text-xl font-medium leading-tight tracking-[-0.02em] text-foreground">
                {value}
              </p>
            )
          ) : (
            <p className="text-sm italic text-muted-foreground">{placeholder}</p>
          )}
        </button>
      )}
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
  const typeLabel =
    node.sourceType === "research" ? "Research" : isInsight ? "Insight" : "Theme group";

  return (
    <div className="flex flex-col gap-4">
      {/* Header: type label + title + badges */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {typeLabel}
        </p>
        <p className="text-xl font-medium leading-tight tracking-[-0.02em] text-foreground">
          {node.label}
        </p>
        {(node.sourceConsultationTitle || node.accepted) ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {node.sourceConsultationTitle ? (
              <Badge variant="secondary" className="text-[10px]">
                {node.sourceConsultationTitle}
              </Badge>
            ) : null}
            {node.accepted ? (
              <Badge variant="secondary" className="text-[10px]">
                Accepted
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Description */}
      {node.description ? (
        <>
          <Separator />
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Description
            </p>
            <p className="text-sm leading-relaxed text-foreground">{node.description}</p>
          </div>
        </>
      ) : null}

      {/* Research quote */}
      {node.sourceType === "research" && node.researchQuotePreview ? (
        <>
          <Separator />
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Source quote
            </p>
            <blockquote className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {node.researchQuotePreview}
            </blockquote>
          </div>
        </>
      ) : null}

      {/* Actions */}
      {isInsight && node.groupId ? (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Actions
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => void onUngroupInsight(node.id)}
            >
              <Unlink className="h-3.5 w-3.5" />
              Ungroup insight
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function EdgeEditForm({
  edge,
  nodes,
  roundId,
  onQuickTypeSelect,
  onDeleted,
}: {
  edge: CanvasEdge;
  nodes: CanvasNode[];
  roundId: string;
  onQuickTypeSelect: (edge: CanvasEdge) => void;
  onDeleted: () => void;
}) {
  const [note, setNote] = useState(edge.note ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateMutation = useUpdateEdge(roundId);
  const deleteMutation = useDeleteEdge(roundId);

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

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { defaultFilterState, type CanvasFilterState } from "@/types/canvas";
import { CanvasGraph } from "@/components/canvas/canvas-graph";

interface CanvasShellProps {
  consultationId: string;
  consultationTitle: string;
}

/**
 * Evidence Network Canvas shell.
 *
 * Structural scaffold only — graph library integration (React Flow) is
 * the next implementation step. This establishes:
 *   - the toolbar / filter bar region
 *   - the split layout (graph area + side panel)
 *   - the AI suggestions panel slot
 *   - filter state wiring
 */
export function CanvasShell({ consultationId, consultationTitle }: CanvasShellProps) {
  const [filters, setFilters] = useState<CanvasFilterState>(defaultFilterState);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const selectedId = selectedNodeId ?? selectedEdgeId;
  const [showSuggestions, setShowSuggestions] = useState(false);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <span className="text-sm font-medium text-muted-foreground">
          {consultationTitle}
        </span>
        <Separator orientation="vertical" className="h-4" />

        <div className="flex items-center gap-2">
          <ToolbarFilterBadge
            label="Themes"
            active={filters.nodeTypes.includes("theme")}
            onClick={() =>
              setFilters((f) => ({
                ...f,
                nodeTypes: f.nodeTypes.includes("theme")
                  ? f.nodeTypes.filter((t) => t !== "theme")
                  : [...f.nodeTypes, "theme"],
              }))
            }
          />
          <ToolbarFilterBadge
            label="Insights"
            active={filters.nodeTypes.includes("insight")}
            onClick={() =>
              setFilters((f) => ({
                ...f,
                nodeTypes: f.nodeTypes.includes("insight")
                  ? f.nodeTypes.filter((t) => t !== "insight")
                  : [...f.nodeTypes, "insight"],
              }))
            }
          />
          <ToolbarFilterBadge
            label="Accepted only"
            active={filters.acceptedOnly}
            onClick={() =>
              setFilters((f) => ({ ...f, acceptedOnly: !f.acceptedOnly }))
            }
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSuggestions((v) => !v)}
          >
            AI suggestions
          </Button>
          {/* Save status — wired up when persistence layer is implemented */}
          <span className="text-xs text-muted-foreground">Saved</span>
        </div>
      </div>

      {/* Main split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Graph area */}
        <div className="relative flex-1 bg-muted/30">
          <CanvasGraph
            consultationId={consultationId}
            filters={filters}
            onNodeSelect={setSelectedNodeId}
            onEdgeSelect={setSelectedEdgeId}
          />
        </div>

        {/* Side panel */}
        {(selectedId || showSuggestions) && (
          <div className="w-80 shrink-0 border-l bg-background">
            {showSuggestions ? (
              <AiSuggestionsPanelPlaceholder />
            ) : (
              <NodeDetailPanelPlaceholder nodeId={selectedId} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components — placeholders until graph library is wired
// ---------------------------------------------------------------------------

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


function NodeDetailPanelPlaceholder({ nodeId }: { nodeId: string | null }) {
  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <p className="text-sm font-medium">Node detail</p>
      <p className="text-xs text-muted-foreground">id: {nodeId}</p>
      <Separator />
      <p className="text-xs text-muted-foreground">
        Connection edit form goes here.
        <br />
        Fields: connection type, note (max 500 chars), delete.
      </p>
    </div>
  );
}

function AiSuggestionsPanelPlaceholder() {
  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <p className="text-sm font-medium">AI suggestions</p>
      <Separator />
      <p className="text-xs text-muted-foreground">
        Suggestions are generated on request.
        <br />
        Each card shows: source → target, suggested connection type, rationale.
        <br />
        Accept adds the edge. Reject dismisses. Both are audited.
      </p>
    </div>
  );
}

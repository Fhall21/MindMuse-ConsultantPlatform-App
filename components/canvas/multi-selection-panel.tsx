"use client";

import { Layers3, GitBranch, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { CanvasNode } from "@/types/canvas";

interface MultiSelectionPanelProps {
  selectedNodeIds: string[];
  nodes: CanvasNode[];
  isGrouping: boolean;
  isConnecting: boolean;
  isReorganising: boolean;
  onGroup: () => void;
  onConnect: () => void;
  onReorganise: () => void;
  onClear: () => void;
}

export function MultiSelectionPanel({
  selectedNodeIds,
  nodes,
  isGrouping,
  isConnecting,
  isReorganising,
  onGroup,
  onConnect,
  onReorganise,
  onClear,
}: MultiSelectionPanelProps) {
  const selectedNodes = nodes.filter((node) => selectedNodeIds.includes(node.id));
  const insightNodes = selectedNodes.filter((node) => node.type === "insight");
  const themeNodes = selectedNodes.filter((node) => node.type === "theme");

  const canGroup = insightNodes.length >= 2;
  const canConnect = selectedNodes.length >= 2;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
            <Layers3 className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{selectedNodes.length} selected</p>
            <p className="text-xs text-muted-foreground">
              {insightNodes.length > 0 && `${insightNodes.length} insight${insightNodes.length !== 1 ? "s" : ""}`}
              {insightNodes.length > 0 && themeNodes.length > 0 && ", "}
              {themeNodes.length > 0 && `${themeNodes.length} theme${themeNodes.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClear}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Selected items */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {selectedNodes.map((node) => (
            <div
              key={node.id}
              className={cn(
                "flex items-start gap-2 rounded-md px-2 py-1.5",
                node.type === "theme"
                  ? "bg-violet-50 dark:bg-violet-950/30"
                  : "bg-muted/40"
              )}
            >
              <div
                className={cn(
                  "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                  node.type === "theme" ? "bg-violet-400" : "bg-primary/60"
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{node.label}</p>
                {node.sourceConsultationTitle ? (
                  <p className="truncate text-[10px] text-muted-foreground">
                    {node.sourceConsultationTitle}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Actions */}
      <div className="space-y-2 p-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Actions
        </p>

        <Button
          variant="secondary"
          size="sm"
          className="w-full justify-start gap-2"
          disabled={isReorganising}
          onClick={onReorganise}
        >
          {isReorganising ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <GitBranch className="h-3.5 w-3.5" />
          )}
          {isReorganising ? "Reorganising..." : "Reorganise selected"}
        </Button>

        <Button
          variant="default"
          size="sm"
          className="w-full justify-start gap-2"
          disabled={!canGroup || isGrouping}
          onClick={onGroup}
          title={!canGroup ? "Select 2 or more insights to group" : undefined}
        >
          {isGrouping ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Layers3 className="h-3.5 w-3.5" />
          )}
          {isGrouping ? "Grouping…" : "Group into theme"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          disabled={!canConnect || isConnecting}
          onClick={onConnect}
          title={!canConnect ? "Select 2 or more nodes to connect" : undefined}
        >
          {isConnecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <GitBranch className="h-3.5 w-3.5" />
          )}
          {isConnecting ? "Connecting…" : "Connect in chain"}
        </Button>

        {!canGroup && insightNodes.length < 2 ? (
          <p className="text-[10px] text-muted-foreground">
            Select 2+ insights to enable grouping
          </p>
        ) : null}
      </div>
    </div>
  );
}

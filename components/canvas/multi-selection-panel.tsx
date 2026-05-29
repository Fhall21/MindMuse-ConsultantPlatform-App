"use client";

import { useMemo, type ReactNode } from "react";
import { GitBranch, Layers3, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { CanvasNode } from "@/types/canvas";

interface MultiSelectionPanelProps {
  selectedNodeIds: string[];
  nodes: CanvasNode[];
  organiseControl: ReactNode;
  isGrouping: boolean;
  isConnecting: boolean;
  onGroup: () => void;
  onConnect: () => void;
  onClear: () => void;
}

export function MultiSelectionPanel({
  selectedNodeIds,
  nodes,
  organiseControl,
  isGrouping,
  isConnecting,
  onGroup,
  onConnect,
  onClear,
}: MultiSelectionPanelProps) {
  const selectedNodes = useMemo(
    () => nodes.filter((node) => selectedNodeIds.includes(node.id)),
    [nodes, selectedNodeIds]
  );
  const selectedInsightNodes = useMemo(
    () => selectedNodes.filter((node) => node.type === "insight"),
    [selectedNodes]
  );
  const selectedThemeNodes = useMemo(
    () => selectedNodes.filter((node) => node.type === "theme"),
    [selectedNodes]
  );
  const groupedInsightSections = useMemo(() => {
    const sections = new Map<
      string,
      {
        title: string;
        insights: CanvasNode[];
      }
    >();
    const ungroupedInsights: CanvasNode[] = [];

    for (const insight of selectedInsightNodes) {
      if (!insight.groupId) {
        ungroupedInsights.push(insight);
        continue;
      }

      const existing = sections.get(insight.groupId);
      if (existing) {
        existing.insights.push(insight);
        continue;
      }

      sections.set(insight.groupId, {
        title:
          nodes.find((node) => node.type === "theme" && node.id === insight.groupId)?.label ??
          "Group",
        insights: [insight],
      });
    }

    return {
      grouped: Array.from(sections.entries()).map(([groupId, section]) => ({
        groupId,
        ...section,
      })),
      ungrouped: ungroupedInsights,
    };
  }, [nodes, selectedInsightNodes]);

  const canGroup = selectedInsightNodes.length >= 2;
  const canConnect = selectedNodes.length >= 2;

  function renderSelectionItem(node: CanvasNode, accent: "theme" | "insight") {
    return (
      <div
        key={node.id}
        className={cn(
          "flex items-start gap-2 rounded-md px-2 py-1.5",
          accent === "theme" ? "bg-violet-50 dark:bg-violet-950/30" : "bg-muted/40"
        )}
      >
        <div
          className={cn(
            "mt-0.5 h-2 w-2 shrink-0 rounded-full",
            accent === "theme" ? "bg-violet-400" : "bg-primary/60"
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
    );
  }

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
              {selectedInsightNodes.length > 0 &&
                `${selectedInsightNodes.length} insight${selectedInsightNodes.length !== 1 ? "s" : ""}`}
              {selectedInsightNodes.length > 0 && selectedThemeNodes.length > 0 && ", "}
              {selectedThemeNodes.length > 0 &&
                `${selectedThemeNodes.length} theme${selectedThemeNodes.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClear}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Selected items */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-4">
          {selectedThemeNodes.length > 0 ? (
            <section className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Selected groups
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {selectedThemeNodes.length}
                </p>
              </div>
              <div className="space-y-1">
                {selectedThemeNodes.map((node) => renderSelectionItem(node, "theme"))}
              </div>
            </section>
          ) : null}

          {groupedInsightSections.grouped.map((section) => (
            <section key={section.groupId} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </p>
                <p className="text-[10px] text-muted-foreground">{section.insights.length}</p>
              </div>
              <div className="space-y-1">
                {section.insights.map((node) => renderSelectionItem(node, "insight"))}
              </div>
            </section>
          ))}

          {groupedInsightSections.ungrouped.length > 0 ? (
            <section className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Ungrouped
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {groupedInsightSections.ungrouped.length}
                </p>
              </div>
              <div className="space-y-1">
                {groupedInsightSections.ungrouped.map((node) =>
                  renderSelectionItem(node, "insight")
                )}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <Separator />

      {/* Actions */}
      <div className="space-y-2 p-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Actions
        </p>

        {organiseControl}

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

        {!canGroup && selectedInsightNodes.length < 2 ? (
          <p className="text-[10px] text-muted-foreground">
            Select 2+ insights to enable grouping
          </p>
        ) : null}
      </div>
    </div>
  );
}

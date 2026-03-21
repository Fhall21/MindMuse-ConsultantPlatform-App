"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GripVertical, Link2, Layers3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CanvasNode } from "@/types/canvas";

export interface CanvasNodeCardData {
  node: CanvasNode;
  memberPreviewLabels: string[];
}

function CanvasNodeCardComponent({
  data,
  selected,
}: NodeProps) {
  const typedData = data as unknown as CanvasNodeCardData;
  const node = typedData.node;
  const isInsight = node.type === "insight";
  const memberCount = node.memberIds.length;

  return (
    <div
      className={cn(
        "group relative min-h-[132px] min-w-[220px] max-w-[260px] rounded-md border bg-background px-3 py-2.5 transition-shadow",
        selected && "border-primary ring-1 ring-primary/30"
      )}
      data-testid={isInsight ? "canvas-insight-card" : "canvas-group-card"}
    >
      <Handle
        id="target"
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-background !bg-primary"
      />

      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5">
            <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="truncate text-sm font-medium leading-snug text-foreground">{node.label}</p>
          </div>

          {node.description ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{node.description}</p>
          ) : null}

          {!isInsight && typedData.memberPreviewLabels.length ? (
            <div className="space-y-0.5">
              {typedData.memberPreviewLabels.map((label) => (
                <p key={label} className="truncate text-xs text-muted-foreground">
                  • {label}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <Badge variant="outline" className="h-5 shrink-0 rounded-full px-2 text-[10px]">
          {isInsight ? "Insight" : "Group"}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {node.sourceConsultationTitle ? (
          <Badge
            variant="secondary"
            className="h-5 max-w-[150px] truncate rounded-full px-2 text-[10px]"
            title={node.sourceConsultationTitle}
          >
            {node.sourceConsultationTitle}
          </Badge>
        ) : null}

        {node.accepted ? (
          <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">
            Accepted
          </Badge>
        ) : null}

        {isInsight && node.lockedFromSource ? (
          <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">
            Locked
          </Badge>
        ) : null}
        {isInsight && node.isUserAdded ? (
          <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">
            User added
          </Badge>
        ) : null}
        {!isInsight ? (
          <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">
            {memberCount} insight{memberCount === 1 ? "" : "s"}
          </Badge>
        ) : null}

        {selected ? (
          <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px]">
            Selected
          </Badge>
        ) : null}
      </div>

      <div className="pointer-events-none mt-2 flex items-center justify-between border-t pt-2 text-[10px] font-medium text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Layers3 className="h-3 w-3" />
          Drag onto another card to group
        </span>
        <span className="inline-flex items-center gap-1">
          <Link2 className="h-3 w-3" />
          Connect
        </span>
      </div>

      <Handle
        id="source"
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-background !bg-primary"
      />
    </div>
  );
}

export const CanvasNodeCard = memo(CanvasNodeCardComponent);

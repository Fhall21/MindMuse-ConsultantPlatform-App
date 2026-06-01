"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ChatCardProps } from "@/components/chat/cards/types";

export function ToolResultFallbackCard({ tool }: ChatCardProps) {
  return (
    <Collapsible className="rounded-lg border bg-card text-card-foreground">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium">
        <span>Tool: {tool.toolName}</span>
        <span className="text-xs text-muted-foreground">Details</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-4 py-3">
        <pre className="max-h-48 overflow-auto text-xs text-muted-foreground">
          {JSON.stringify({ input: tool.input, output: tool.output }, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

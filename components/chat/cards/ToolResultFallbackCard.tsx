"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import type { ChatCardProps } from "./types";

export function ToolResultFallbackCard({ tool }: ChatCardProps) {
  return (
    <ChatToolCardShell
      title={`Tool: ${tool.toolName}`}
      description="Unexpected tool result. Expand to inspect raw payload."
    >
      <Collapsible>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-left text-sm font-medium hover:bg-muted/40">
          <span>Raw input and output</span>
          <span className="text-xs text-muted-foreground">Details</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <pre className="max-h-48 overflow-auto rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
            {JSON.stringify({ input: tool.input, output: tool.output }, null, 2)}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </ChatToolCardShell>
  );
}

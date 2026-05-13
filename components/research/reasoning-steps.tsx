"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ReasoningStep } from "@/hooks/use-research";

interface ReasoningStepsProps {
  steps: ReasoningStep[];
  isLoading?: boolean;
}

export function ReasoningSteps({ steps, isLoading = false }: ReasoningStepsProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (steps.length === 0) {
    if (!isLoading) return null;
    return (
      <p className="text-sm text-muted-foreground">Waiting for first steps…</p>
    );
  }

  return (
    <div className="w-full space-y-1">
      {steps.map((step, i) => {
        const isActive = isLoading && i === steps.length - 1;
        return (
          <Collapsible
            key={i}
            open={openIndex === i}
            onOpenChange={(open) => setOpenIndex(open ? i : null)}
          >
            <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium hover:bg-muted/50 transition-colors">
              {isActive ? (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
              ) : (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold text-muted-foreground">
                  {i + 1}
                </span>
              )}
              <span className={`flex-1 ${isActive ? "text-primary" : ""}`}>
                {step.label}
              </span>
              {!isActive && (
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                  style={{ transform: openIndex === i ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-none">
              <p className="pb-2 pl-9 pr-2 text-sm text-muted-foreground">
                {step.detail}
              </p>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

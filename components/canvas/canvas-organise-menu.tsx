"use client";

import type { SVGProps } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CanvasLayoutDirection } from "@/lib/canvas-layout";
import { cn } from "@/lib/utils";

const DIRECTION_OPTIONS: Array<{
  value: CanvasLayoutDirection;
  label: string;
  shortcut: string;
  description: string;
  helper: string;
}> = [
  {
    value: "LR",
    label: "Left to right",
    shortcut: "LR",
    description: "Start on the left and let the thread unfold to the right",
    helper: "Best for a mindmap that reads like a sentence",
  },
  {
    value: "TB",
    label: "Top to bottom",
    shortcut: "TB",
    description: "Start at the top and stack the thread downward",
    helper: "Best for scan-down summaries and vertical canvases",
  },
  {
    value: "RL",
    label: "Right to left",
    shortcut: "RL",
    description: "Start on the right and let the thread unfold to the left",
    helper: "Useful when the anchor already sits on the right edge",
  },
  {
    value: "BT",
    label: "Bottom to top",
    shortcut: "BT",
    description: "Start at the bottom and lift the thread upward",
    helper: "Useful when there is open space above the current cluster",
  },
];

interface CanvasOrganiseMenuProps {
  disabled?: boolean;
  isOrganising?: boolean;
  label: string;
  scopeLabel: string;
  onSelect: (direction: CanvasLayoutDirection) => void;
  fullWidth?: boolean;
}

function OrganiseTriggerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4.25 4.75h9.5M4.25 9h9.5M4.25 13.25h9.5"
        className="stroke-current/35"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <circle
        cx="5"
        cy="4.75"
        r="1.2"
        className="fill-current transition-transform duration-200 ease-out motion-safe:group-hover:-translate-x-0.5"
      />
      <circle
        cx="9"
        cy="9"
        r="1.2"
        className="fill-current transition-transform duration-200 ease-out motion-safe:group-hover:translate-y-0.5"
      />
      <circle
        cx="13"
        cy="13.25"
        r="1.2"
        className="fill-current transition-transform duration-200 ease-out motion-safe:group-hover:translate-x-0.5"
      />
    </svg>
  );
}

function OrganiseDirectionIcon({
  direction,
  className,
}: {
  direction: CanvasLayoutDirection;
  className?: string;
}) {
  const isHorizontal = direction === "LR" || direction === "RL";
  const reverse = direction === "RL" || direction === "BT";

  const dotClasses = isHorizontal
    ? reverse
      ? [
          "motion-safe:group-hover:-translate-x-0.5",
          "",
          "motion-safe:group-hover:translate-x-0.5",
        ]
      : [
          "motion-safe:group-hover:translate-x-0.5",
          "",
          "motion-safe:group-hover:-translate-x-0.5",
        ]
    : reverse
      ? [
          "motion-safe:group-hover:-translate-y-0.5",
          "",
          "motion-safe:group-hover:translate-y-0.5",
        ]
      : [
          "motion-safe:group-hover:translate-y-0.5",
          "",
          "motion-safe:group-hover:-translate-y-0.5",
        ];

  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
      {isHorizontal ? (
        <>
          <path
            d={reverse ? "M22 14H6m0 0 3-3m-3 3 3 3" : "M6 14h16m0 0-3-3m3 3-3 3"}
            className="stroke-current/60"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="8"
            cy="9"
            r="2.15"
            className={cn(
              "fill-current transition-transform duration-200 ease-out",
              dotClasses[0]
            )}
          />
          <circle
            cx="14"
            cy="14"
            r="2.15"
            className={cn(
              "fill-current transition-transform duration-200 ease-out",
              dotClasses[1]
            )}
          />
          <circle
            cx="20"
            cy="19"
            r="2.15"
            className={cn(
              "fill-current transition-transform duration-200 ease-out",
              dotClasses[2]
            )}
          />
        </>
      ) : (
        <>
          <path
            d={reverse ? "M14 22V6m0 0-3 3m3-3 3 3" : "M14 6v16m0 0-3-3m3 3 3-3"}
            className="stroke-current/60"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="9"
            cy="8"
            r="2.15"
            className={cn(
              "fill-current transition-transform duration-200 ease-out",
              dotClasses[0]
            )}
          />
          <circle
            cx="14"
            cy="14"
            r="2.15"
            className={cn(
              "fill-current transition-transform duration-200 ease-out",
              dotClasses[1]
            )}
          />
          <circle
            cx="19"
            cy="20"
            r="2.15"
            className={cn(
              "fill-current transition-transform duration-200 ease-out",
              dotClasses[2]
            )}
          />
        </>
      )}
    </svg>
  );
}

export function CanvasOrganiseMenu({
  disabled = false,
  isOrganising = false,
  label,
  scopeLabel,
  onSelect,
  fullWidth = false,
}: CanvasOrganiseMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isOrganising}
          className={cn(
            "group gap-2 border-border/70 bg-background/85 shadow-sm transition-colors hover:bg-accent/40 hover:text-foreground",
            fullWidth ? "w-full justify-between px-3" : "min-w-[10.5rem] justify-between"
          )}
        >
          <span className="flex items-center gap-2">
            {isOrganising ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-foreground/[0.06] text-foreground/80 transition-colors duration-200 group-hover:bg-foreground/[0.08]">
                <OrganiseTriggerIcon className="h-3.5 w-3.5" />
              </span>
            )}
            <span>{isOrganising ? "Organising..." : label}</span>
          </span>
          {!isOrganising ? (
            <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform duration-200 group-hover:-translate-y-px" />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={fullWidth ? "center" : "end"} className="min-w-56">
        <DropdownMenuLabel
          className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
          title={scopeLabel}
        >
          Direction
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <TooltipProvider delayDuration={0}>
          {DIRECTION_OPTIONS.map((option) => (
            <Tooltip key={option.value}>
              <TooltipTrigger asChild>
                <DropdownMenuItem
                  onSelect={() => onSelect(option.value)}
                  className="group gap-3 rounded-md px-2 py-2"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-foreground/75 transition-colors duration-200 group-hover:border-border group-hover:bg-background group-hover:text-foreground">
                    <OrganiseDirectionIcon direction={option.value} className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-none">{option.label}</span>
                    <span className="sr-only">
                      {option.description}. {option.helper}
                    </span>
                  </span>
                  <DropdownMenuShortcut>{option.shortcut}</DropdownMenuShortcut>
                </DropdownMenuItem>
              </TooltipTrigger>
              <TooltipContent
                side="left"
                sideOffset={8}
                className="max-w-64 flex-col items-start text-left leading-snug"
              >
                <span className="block font-medium">{option.description}</span>
                <span className="block text-background/85">{option.helper}</span>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { ChevronDown, GitBranch, Loader2 } from "lucide-react";
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
import type { CanvasLayoutDirection } from "@/lib/canvas-layout";
import { cn } from "@/lib/utils";

const DIRECTION_OPTIONS: Array<{
  value: CanvasLayoutDirection;
  label: string;
  shortcut: string;
}> = [
  { value: "LR", label: "Left to right", shortcut: "LR" },
  { value: "TB", label: "Top to bottom", shortcut: "TB" },
  { value: "RL", label: "Right to left", shortcut: "RL" },
  { value: "BT", label: "Bottom to top", shortcut: "BT" },
];

interface CanvasOrganiseMenuProps {
  disabled?: boolean;
  isOrganising?: boolean;
  label: string;
  scopeLabel: string;
  onSelect: (direction: CanvasLayoutDirection) => void;
  fullWidth?: boolean;
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
            "gap-2 border-border/70 bg-background/85 shadow-sm transition-colors hover:bg-accent/40 hover:text-foreground",
            fullWidth ? "w-full justify-between px-3" : "min-w-[10.5rem] justify-between"
          )}
        >
          <span className="flex items-center gap-2">
            {isOrganising ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <GitBranch className="h-3.5 w-3.5" />
            )}
            <span>{isOrganising ? "Organising..." : label}</span>
          </span>
          {!isOrganising ? <ChevronDown className="h-3.5 w-3.5 opacity-60" /> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={fullWidth ? "center" : "end"} className="min-w-56">
        <DropdownMenuLabel>{scopeLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {DIRECTION_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => onSelect(option.value)}
            className="gap-3"
          >
            <span>{option.label}</span>
            <DropdownMenuShortcut>{option.shortcut}</DropdownMenuShortcut>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

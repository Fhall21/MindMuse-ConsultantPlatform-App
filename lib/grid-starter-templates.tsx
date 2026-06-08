"use client";

import { cn } from "@/lib/utils";

export const STARTER_TEMPLATES = [
  {
    label: "What emotional burdens did participants describe?",
    category: "psychosocial",
  },
  {
    label: "What resilience or coping strategies emerged?",
    category: "psychosocial",
  },
  {
    label: "What systemic or structural barriers were identified?",
    category: "psychosocial",
  },
  {
    label: "How did participants describe their support networks?",
    category: "psychosocial",
  },
  {
    label: "What did participants need most? (Needs)",
    category: "design-thinking",
  },
  {
    label: "What caused the most frustration or difficulty? (Pains)",
    category: "design-thinking",
  },
  {
    label: "What positive outcomes or improvements would they value? (Gains)",
    category: "design-thinking",
  },
  {
    label: "What themes came up across multiple participants?",
    category: "universal",
  },
] as const;

export type StarterTemplate = (typeof STARTER_TEMPLATES)[number];

export function SuggestionRow({
  label,
  onSelect,
}: {
  label: string;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(label)}
      className={cn(
        "w-full rounded-md border border-border bg-background px-3 py-2 text-left text-xs leading-5",
        "text-muted-foreground transition-colors hover:border-border/80 hover:bg-muted/40 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      {label}
    </button>
  );
}

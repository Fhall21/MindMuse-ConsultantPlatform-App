"use client";

import { Badge } from "@/components/ui/badge";
import type { RoundThemeGroupStatus } from "@/types/round-detail";

interface DecisionBadgeProps {
  status: RoundThemeGroupStatus;
}

const statusConfig: Record<
  RoundThemeGroupStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400",
  },
  accepted: {
    label: "Accepted",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  discarded: {
    label: "Discarded",
    className: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300",
  },
  management_rejected: {
    label: "Mgmt Rejected",
    className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
  },
};

export function DecisionBadge({ status }: DecisionBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

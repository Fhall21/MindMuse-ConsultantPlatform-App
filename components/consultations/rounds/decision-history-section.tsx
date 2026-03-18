"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RoundDecisionHistoryEntry } from "@/types/round-detail";

interface DecisionHistorySectionProps {
  decisions: RoundDecisionHistoryEntry[];
}

const decisionTypeConfig: Record<
  string,
  { label: string; className: string }
> = {
  accept: {
    label: "Accepted",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  discard: {
    label: "Discarded",
    className: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300",
  },
  management_reject: {
    label: "Mgmt Rejected",
    className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
  },
};

export function DecisionHistorySection({
  decisions,
}: DecisionHistorySectionProps) {
  if (decisions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Decision History</CardTitle>
          <CardDescription>
            No decisions recorded for this round yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Decision History</CardTitle>
        <CardDescription>
          {decisions.length} decision{decisions.length !== 1 ? "s" : ""} recorded
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {decisions.map((d) => {
            const config = decisionTypeConfig[d.decisionType] ?? decisionTypeConfig.accept;
            return (
              <div key={d.id} className="flex items-start gap-3 rounded-md border px-3 py-2">
                <Badge variant="outline" className={config.className}>
                  {config.label}
                </Badge>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm">
                    <span className="font-medium">{d.targetLabel}</span>
                    <span className="text-muted-foreground"> ({d.targetType.replace("_", " ")})</span>
                  </p>
                  {d.rationale ? (
                    <p className="text-xs text-muted-foreground">
                      Rationale: {d.rationale}
                    </p>
                  ) : null}
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(d.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

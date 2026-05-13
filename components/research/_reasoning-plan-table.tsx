"use client";

import { cn } from "@/lib/utils";
import type { PlanStepData } from "@/hooks/use-research";

interface PlanTableProps {
  data: PlanStepData;
}

const STATUS_TONE: Record<
  PlanStepData["rows"][number]["status"],
  string
> = {
  COMPLETED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  "IN-PROGRESS": "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  PENDING: "bg-muted text-muted-foreground",
};

function StatusBadge({ status }: { status: PlanStepData["rows"][number]["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[3px] px-1.5 py-0.5",
        "font-mono text-[9px] font-semibold uppercase tracking-wider",
        STATUS_TONE[status]
      )}
    >
      {status}
    </span>
  );
}

function Cell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={cn("align-top py-2.5 pr-4 text-xs leading-relaxed text-foreground/80", className)}>
      {children || <span className="text-muted-foreground/40">—</span>}
    </td>
  );
}

export function ReasoningPlanTable({ data }: PlanTableProps) {
  if (data.rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Plan was not surfaced for this query.</p>;
  }

  return (
    <>
      {/* Desktop: table */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border/50 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-3 w-8">#</th>
                <th className="pb-2 pr-4">Objective</th>
                <th className="pb-2 pr-4">Rationale</th>
                <th className="pb-2 pr-4 w-24">Status</th>
                <th className="pb-2 pr-4">Result</th>
                <th className="pb-2 pr-0">Evaluation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {data.rows.map((row) => (
                <tr key={row.id}>
                  <Cell className="text-muted-foreground/60 tabular-nums">{row.id}</Cell>
                  <Cell className="text-foreground/90 font-medium">{row.objective}</Cell>
                  <Cell>{row.rationale}</Cell>
                  <Cell><StatusBadge status={row.status} /></Cell>
                  <Cell>{row.result}</Cell>
                  <Cell>{row.evaluation}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile (<768px): stacked cards */}
      <div className="md:hidden space-y-3">
        {data.rows.map((row) => (
          <div key={row.id} className="rounded-md border bg-card/40 p-3">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Objective {row.id}
              </span>
              <StatusBadge status={row.status} />
            </div>
            <p className="text-sm font-medium leading-snug text-foreground">{row.objective}</p>
            {row.rationale && (
              <PlanField label="Rationale" value={row.rationale} />
            )}
            {row.result && (
              <PlanField label="Result" value={row.result} />
            )}
            {row.evaluation && (
              <PlanField label="Evaluation" value={row.evaluation} />
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function PlanField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-foreground/80">{value}</p>
    </div>
  );
}

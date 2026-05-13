"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useResearchSessions } from "@/hooks/use-research";
import type { ResearchSessionSummary } from "@/hooks/use-research";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Inline status label for non-running, non-complete states.
function StatusLabel({ status }: { status: ResearchSessionSummary["status"] }) {
  if (status === "pending") {
    return (
      <span className="text-[11px] text-muted-foreground/50 leading-none">
        Queued
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="text-[11px] text-destructive/60 leading-none">
        Failed
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="text-[11px] text-muted-foreground/50 leading-none">
        Cancelled
      </span>
    );
  }
  return null;
}

export function ResearchSessionList() {
  const { data: sessions, isLoading, error } = useResearchSessions();

  if (isLoading) {
    return (
      <div className="space-y-3 pt-6 border-t border-border/60">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Previous searches
        </p>
        <div className="divide-y divide-border/40">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 py-3">
              <div className="w-4 shrink-0 pt-0.5" />
              <div className="flex-1 space-y-1.5 min-w-0">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-3/4 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-6 border-t border-border/60">
        <p className="text-sm text-destructive">Could not load previous searches.</p>
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="pt-6 border-t border-border/60">
        <p className="text-sm text-muted-foreground">
          No searches yet — try a question above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-6 border-t border-border/60">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Previous searches
      </p>
      <div className="divide-y divide-border/40">
        {sessions.map((session) => {
          const isRunning = session.status === "running";

          return (
            <Link
              key={session.id}
              href={`/research/${session.id}`}
              className="group flex items-start gap-3 rounded px-1 py-3 transition-colors hover:bg-muted/30"
            >
              {/* Left gutter: spinner for running, empty otherwise */}
              <div className="w-4 shrink-0 pt-[3px] flex justify-center">
                {isRunning && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/70" />
                )}
              </div>

              {/* Content: date + status on top, query below (wraps freely) */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] tabular-nums text-muted-foreground/55 leading-none">
                    {formatDate(session.createdAt)}
                  </span>
                  <StatusLabel status={session.status} />
                </div>
                <p className="text-sm leading-snug text-foreground/80 group-hover:text-foreground transition-colors">
                  {session.query}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

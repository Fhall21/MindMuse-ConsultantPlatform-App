"use client";

import Link from "next/link";
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

// Small inline status signal — only shown for non-complete rows.
// No badge: just a dim label or an animated dot so the list stays quiet.
function StatusSignal({ status }: { status: ResearchSessionSummary["status"] }) {
  if (status === "pending") {
    return <span className="text-xs text-muted-foreground/60">Queued</span>;
  }
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
        Searching
      </span>
    );
  }
  if (status === "failed") {
    return <span className="text-xs text-destructive/70">Failed</span>;
  }
  if (status === "cancelled") {
    return <span className="text-xs text-muted-foreground/60">Cancelled</span>;
  }
  return null;
}

export function ResearchSessionList() {
  const { data: sessions, isLoading, error } = useResearchSessions();

  if (isLoading) {
    return (
      <div className="space-y-3 pt-6 border-t border-border/60">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Previous searches</p>
        <div className="space-y-1">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-full rounded" />
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
        <p className="text-sm text-muted-foreground">No searches yet — try a question above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-6 border-t border-border/60">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Previous searches</p>
      <div className="space-y-0">
        {sessions.map((session) => (
          <Link
            key={session.id}
            href={`/research/${session.id}`}
            className="flex items-center justify-between gap-3 rounded px-1 py-2 transition-colors hover:bg-muted/30"
          >
            <p className="min-w-0 flex-1 truncate text-sm">{session.query}</p>
            <div className="flex shrink-0 items-center gap-3">
              <StatusSignal status={session.status} />
              <span className="text-xs text-muted-foreground">
                {formatDate(session.createdAt)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChatSessionSummary } from "@/hooks/use-chat-sessions";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function sessionLabel(session: ChatSessionSummary) {
  if (session.preview) {
    return session.preview;
  }
  if (session.consultationLabel) {
    return session.consultationLabel;
  }
  return "Untitled conversation";
}

interface ChatSessionListProps {
  sessions: ChatSessionSummary[];
  activeSessionId: string | null;
  isLoading?: boolean;
  error?: boolean;
  onSelectSession: (sessionId: string) => void;
}

export function ChatSessionList({
  sessions,
  activeSessionId,
  isLoading = false,
  error = false,
  onSelectSession,
}: ChatSessionListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 border-t border-border/60 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Previous conversations
        </p>
        <div className="divide-y divide-border/40">
          {[1, 2, 3].map((index) => (
            <div key={index} className="flex items-start gap-3 py-3">
              <div className="w-4 shrink-0 pt-0.5" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-4 w-full rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-t border-border/60 pt-4">
        <p className="text-sm text-destructive">Could not load previous conversations.</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Previous conversations
      </p>
      <div className="divide-y divide-border/40">
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;

          return (
            <button
              key={session.id}
              type="button"
              onClick={() => onSelectSession(session.id)}
              className={cn(
                "group flex w-full items-start gap-3 rounded px-1 py-3 text-left transition-colors hover:bg-muted/30",
                isActive && "bg-muted/40"
              )}
            >
              <div className="w-4 shrink-0 pt-[3px] flex justify-center">
                {isActive ? (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-foreground/70"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] tabular-nums leading-none text-muted-foreground/55">
                    {formatDate(session.updatedAt)}
                  </span>
                  {session.consultationLabel ? (
                    <span className="truncate text-[11px] leading-none text-muted-foreground/50">
                      {session.consultationLabel}
                    </span>
                  ) : null}
                </div>
                <p
                  className={cn(
                    "text-sm leading-snug transition-colors",
                    isActive
                      ? "font-medium text-foreground"
                      : "text-foreground/80 group-hover:text-foreground"
                  )}
                >
                  {sessionLabel(session)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import { readAuditTrailOutput } from "@/lib/chat/tools/audit-trail";
import type { ChatCardProps } from "./types";

function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\./g, " — ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AuditTrailCard({ tool, sessionId }: ChatCardProps) {
  const data = useMemo(() => readAuditTrailOutput(tool.output), [tool.output]);

  if (tool.status === "error") {
    return (
      <ChatToolCardShell
        title="Audit trail"
        description="Could not load events"
        error="Couldn't load the audit trail. Refresh or try again."
      />
    );
  }

  const auditPageUrl = data?.consultation_id
    ? `/consultations/${data.consultation_id}/audit`
    : undefined;

  if (!data || data.events.length === 0) {
    return (
      <ChatToolCardShell
        title="Audit trail"
        description="No activity recorded yet. Actions taken in this consultation will appear here."
        footer={
          auditPageUrl ? (
            <Button variant="outline" size="sm" asChild>
              <a href={auditPageUrl} target="_blank" rel="noreferrer">
                Open full audit <ExternalLink className="ml-1.5 size-3.5" />
              </a>
            </Button>
          ) : null
        }
      />
    );
  }

  return (
    <ChatToolCardShell
      title="Audit trail"
      description={`Last ${data.events.length} event${data.events.length !== 1 ? "s" : ""}`}
      footer={
        auditPageUrl ? (
          <Button variant="outline" size="sm" asChild>
            <a href={auditPageUrl} target="_blank" rel="noreferrer">
              Open full audit <ExternalLink className="ml-1.5 size-3.5" />
            </a>
          </Button>
        ) : null
      }
    >
      <ul className="space-y-2">
        {data.events.map((event) => (
          <li key={event.id} className="flex items-start justify-between gap-2 text-sm">
            <span className="text-foreground">{formatAction(event.action)}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDate(event.created_at)}
            </span>
          </li>
        ))}
      </ul>
    </ChatToolCardShell>
  );
}

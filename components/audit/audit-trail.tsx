"use client";

import { useMemo, useState } from "react";

import { useAuditEvents } from "@/hooks/use-audit";
import type { AuditLogEntry } from "@/types/db";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;

interface AuditTrailProps {
  consultationId: string;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error) {
    return error;
  }

  return "Something went wrong. Please try again.";
}

function humanizeAction(action: string) {
  return action
    .split(".")
    .join(" ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getStringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function buildEventLabel(event: AuditLogEntry) {
  const payload = event.payload ?? {};
  const personName = getStringValue(payload.person_name);
  const themeLabel = getStringValue(payload.theme_label);

  switch (event.action) {
    case "consultation.created":
      return "Consultation created";
    case "consultation.transcript_edited":
      return "Transcript updated";
    case "consultation.completed":
      return "Consultation marked complete";
    case "person.linked":
      return personName ? `Person linked: ${personName}` : "Person linked";
    case "person.unlinked":
      return personName ? `Person unlinked: ${personName}` : "Person unlinked";
    case "theme.extraction_requested":
      return "Theme extraction triggered";
    case "theme.accepted":
      return themeLabel ? `Theme accepted: ${themeLabel}` : "Theme accepted";
    case "theme.rejected":
      return themeLabel ? `Theme rejected: ${themeLabel}` : "Theme rejected";
    case "evidence_email.generation_requested":
      return "Email draft generation triggered";
    case "evidence_email.generated":
      return "Email draft generated";
    case "evidence_email.accepted":
      return "Email draft accepted";
    case "evidence_email.sent":
      return "Email marked as sent";
    default:
      return humanizeAction(event.action);
  }
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  const now = Date.now();
  const deltaInSeconds = Math.round((date.getTime() - now) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: "auto",
  });

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];

  for (const [unit, secondsPerUnit] of units) {
    if (Math.abs(deltaInSeconds) >= secondsPerUnit || unit === "second") {
      return formatter.format(Math.round(deltaInSeconds / secondsPerUnit), unit);
    }
  }

  return "Just now";
}

function formatAbsoluteTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getDotClassName(action: string) {
  if (action.startsWith("consultation.")) {
    return "bg-slate-400";
  }

  if (action.startsWith("theme.")) {
    return "bg-emerald-500";
  }

  if (action.startsWith("person.")) {
    return "bg-amber-500";
  }

  if (action.startsWith("evidence_email.")) {
    return "bg-sky-500";
  }

  return "bg-muted-foreground/40";
}

function TimelineEvents({ events }: { events: AuditLogEntry[] }) {
  return (
    <div className="space-y-3">
      {events.map((event, index) => (
        <div key={event.id} className="flex gap-3">
          <div className="flex w-4 flex-col items-center">
            <span className={cn("mt-1 size-2 rounded-full", getDotClassName(event.action))} />
            {index < events.length - 1 ? <span className="mt-1 h-full w-px bg-border/80" /> : null}
          </div>

          <div className="flex-1 space-y-1 pb-3">
            <p className="text-sm text-foreground/85">{buildEventLabel(event)}</p>
            <time className="text-xs text-muted-foreground" dateTime={event.created_at} title={formatAbsoluteTime(event.created_at)}>
              {formatRelativeTime(event.created_at)}
            </time>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AuditTrail({ consultationId }: AuditTrailProps) {
  const auditQuery = useAuditEvents(consultationId);
  const [showEarlier, setShowEarlier] = useState(false);

  const events = auditQuery.data ?? [];
  const { olderEvents, recentEvents } = useMemo(() => {
    const now = Date.now();

    return events.reduce(
      (groups, event) => {
        const createdAt = new Date(event.created_at).getTime();
        if (!Number.isNaN(createdAt) && now - createdAt > SEVEN_DAYS_IN_MS) {
          groups.olderEvents.push(event);
        } else {
          groups.recentEvents.push(event);
        }
        return groups;
      },
      { olderEvents: [] as AuditLogEntry[], recentEvents: [] as AuditLogEntry[] }
    );
  }, [events]);

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Audit Trail</CardTitle>
        <CardDescription>Chronological reference of consultation actions and evidence milestones.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {auditQuery.isPending ? <p className="text-sm text-muted-foreground">Loading audit trail…</p> : null}

        {auditQuery.error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {getErrorMessage(auditQuery.error)}
          </p>
        ) : null}

        {!auditQuery.isPending && !auditQuery.error && events.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
            No audit events recorded yet.
          </p>
        ) : null}

        {!auditQuery.isPending && !auditQuery.error && events.length > 0 ? (
          <div className="space-y-4">
            {olderEvents.length > 0 ? (
              <div className="space-y-3">
                <Button size="xs" variant="ghost" className="h-auto px-0 text-xs text-muted-foreground" onClick={() => setShowEarlier((current) => !current)}>
                  {showEarlier ? "Hide earlier" : `Show earlier (${olderEvents.length})`}
                </Button>
                {showEarlier ? <TimelineEvents events={olderEvents} /> : null}
              </div>
            ) : null}

            {recentEvents.length > 0 ? <TimelineEvents events={recentEvents} /> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

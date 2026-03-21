"use client";

import { useMemo, useState } from "react";

import { useMeetingAuditEvents, useRoundAuditEvents } from "@/hooks/use-audit";
import type { AuditLogEntry } from "@/types/db";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;

interface AuditTrailProps {
  meetingId?: string;
  consultationId?: string;
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
  const groupLabel =
    getStringValue(payload.accepted_label) ??
    getStringValue(payload.draft_label) ??
    getStringValue(payload.current_label) ??
    getStringValue(payload.label);
  const targetType = getStringValue(payload.target_type);

  switch (event.action) {
    // Consultation events
    case "meeting.created":
    case "consultation.created":
      return "Meeting created";
    case "meeting.title_edited":
    case "consultation.title_edited":
      return "Meeting title updated";
    case "meeting.transcript_edited":
    case "consultation.transcript_edited":
      return "Transcript updated";
    case "meeting.notes_edited":
    case "consultation.notes_edited":
      return "Notes updated";
    case "meeting.completed":
    case "consultation.completed":
      return "Meeting marked complete";
    case "meeting.consultation_assigned":
    case "consultation.round_assigned":
      return "Assigned to consultation";

    // Person events
    case "person.linked":
      return personName ? `Person linked: ${personName}` : "Person linked";
    case "person.unlinked":
      return personName ? `Person unlinked: ${personName}` : "Person unlinked";
    case "person.created":
      return "Person record created";
    case "person.updated":
      return "Person record updated";
    case "person.deleted":
      return "Person record deleted";

    // Theme events
    case "theme.extraction_requested":
      return "Theme extraction triggered";
    case "theme.accepted":
      return themeLabel ? `Theme accepted: ${themeLabel}` : "Theme accepted";
    case "theme.rejected":
      return themeLabel ? `Theme rejected: ${themeLabel}` : "Theme rejected";
    case "theme.user_added":
      return themeLabel ? `Theme added: ${themeLabel}` : "Theme added";

    // Evidence email events
    case "evidence_email.generation_requested":
      return "Email draft generation triggered";
    case "evidence_email.generated":
      return "Email draft generated";
    case "evidence_email.accepted":
      return "Email draft accepted";
    case "evidence_email.sent":
      return "Email marked as sent";

    // Transcript / audio / OCR ingestion events
    case "transcript.file_uploaded":
      return "Transcript file uploaded";
    case "transcript.parsed":
      return "Transcript parsed";
    case "audio.uploaded":
      return "Audio file uploaded";
    case "audio.transcription_requested":
      return "Audio transcription requested";
    case "audio.transcription_completed":
      return "Audio transcription completed";
    case "audio.transcription_failed":
      return "Audio transcription failed";
    case "ocr.uploaded":
      return "Handwritten notes uploaded";
    case "ocr.extraction_requested":
      return "OCR extraction requested";
    case "ocr.extraction_completed":
      return "OCR extraction completed";
    case "ocr.extraction_failed":
      return "OCR extraction failed";
    case "ocr.review_accepted":
      return "OCR review accepted";
    case "ocr.review_rejected":
      return "OCR review rejected";
    case "ocr.corrections_saved":
      return "OCR corrections saved";

    // Round lifecycle
    case "round.created":
      return "Round created";
    case "round.updated":
      return "Round updated";
    case "round.deleted":
      return "Round deleted";

    // Round theme group events
    case "round.theme_group_created":
      return groupLabel ? `Theme group created: ${groupLabel}` : "Theme group created";
    case "round.theme_group_updated":
      return groupLabel ? `Theme group updated: ${groupLabel}` : "Theme group updated";
    case "round.theme_group_merged":
      return "Theme groups merged";
    case "round.theme_group_split":
      return "Theme group split";
    case "round.theme_group_member_moved":
      return "Theme moved between groups";

    // Round draft events
    case "round.theme_group_draft_created":
      return groupLabel ? `AI draft created: ${groupLabel}` : "AI draft created for theme group";
    case "round.theme_group_draft_accepted":
      return groupLabel ? `Draft accepted: ${groupLabel}` : "Theme group draft accepted";
    case "round.theme_group_draft_discarded":
      return "Theme group draft discarded";

    // Round decision events
    case "round.target_accepted": {
      const typeLabel = targetType === "theme_group" ? "theme group" : targetType === "source_theme" ? "source theme" : "item";
      return `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} accepted`;
    }
    case "round.target_discarded": {
      const typeLabel = targetType === "theme_group" ? "theme group" : targetType === "source_theme" ? "source theme" : "item";
      return `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} discarded`;
    }
    case "round.target_management_rejected": {
      const typeLabel = targetType === "theme_group" ? "theme group" : targetType === "source_theme" ? "source theme" : "item";
      return `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} management rejected`;
    }

    // Round output
    case "round.output_generated":
      return "Round output generated";

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
  if (action.startsWith("meeting.") || action.startsWith("consultation.")) {
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

  if (action.startsWith("round.")) {
    return "bg-violet-500";
  }

  if (action.startsWith("transcript.") || action.startsWith("audio.") || action.startsWith("ocr.")) {
    return "bg-teal-500";
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

function AuditTrailCard({
  auditQuery,
}: {
  auditQuery: ReturnType<typeof useMeetingAuditEvents> | ReturnType<typeof useRoundAuditEvents>;
}) {
  const [showEarlier, setShowEarlier] = useState(false);

  const events = useMemo(() => auditQuery.data ?? [], [auditQuery.data]);
  const referenceTime = auditQuery.dataUpdatedAt || 0;

  const { olderEvents, recentEvents } = useMemo(() => {
    return events.reduce(
      (groups, event) => {
        const createdAt = new Date(event.created_at).getTime();
        if (!Number.isNaN(createdAt) && referenceTime - createdAt > SEVEN_DAYS_IN_MS) {
          groups.olderEvents.push(event);
        } else {
          groups.recentEvents.push(event);
        }
        return groups;
      },
      { olderEvents: [] as AuditLogEntry[], recentEvents: [] as AuditLogEntry[] }
    );
  }, [events, referenceTime]);

  return (
    <Card className="border-border/70">
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

export function AuditTrail({ meetingId, consultationId }: AuditTrailProps) {
  const resolvedMeetingId = meetingId ?? consultationId;
  const auditQuery = useMeetingAuditEvents(resolvedMeetingId ?? "");
  return <AuditTrailCard auditQuery={auditQuery} />;
}

interface RoundAuditTrailProps {
  roundId: string;
}

export function RoundAuditTrail({ roundId }: RoundAuditTrailProps) {
  const auditQuery = useRoundAuditEvents(roundId);
  return (
    <AuditTrailCard
      auditQuery={auditQuery}
    />
  );
}

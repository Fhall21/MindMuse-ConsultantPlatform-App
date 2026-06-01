"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { useConsultations } from "@/hooks/use-consultations";
import type { MeetingDraft } from "@/lib/chat/tools/intake";
import { readMeetingDraft, type ChatCardProps } from "./types";

function toDateInputValue(isoDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(isoDate)) {
    return isoDate.slice(0, 10);
  }
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

function toIsoDate(dateValue: string): string {
  return `${dateValue}T12:00:00.000Z`;
}

export function MeetingConfirmationCard({
  tool,
  messageId,
  sessionId,
  onUpdated,
}: ChatCardProps) {
  const initialDraft = useMemo(() => readMeetingDraft(tool.output), [tool.output]);
  const { data: consultations = [], isLoading: consultationsLoading } =
    useConsultations();
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `confirm-meeting:${messageId}`;

  const [draft, setDraft] = useState<MeetingDraft | null>(initialDraft);
  const [projectId, setProjectId] = useState(
    initialDraft?.project_id ?? consultations[0]?.id ?? ""
  );
  const [participantsText, setParticipantsText] = useState(
    initialDraft?.participants.join(", ") ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [savedMeetingId, setSavedMeetingId] = useState<string | null>(null);
  const confirming = isPending(confirmKey);
  const status = tool.status ?? "pending";
  const toolResultId = tool.toolResultId;

  useEffect(() => {
    if (initialDraft) {
      setDraft(initialDraft);
      setParticipantsText(initialDraft.participants.join(", "));
      if (initialDraft.project_id) {
        setProjectId(initialDraft.project_id);
      }
    }
  }, [initialDraft]);

  useEffect(() => {
    if (!projectId && consultations[0]?.id) {
      setProjectId(consultations[0].id);
    }
  }, [consultations, projectId]);

  const persistPendingDraft = useCallback(
    async (nextDraft: MeetingDraft, nextProjectId: string) => {
      if (status !== "pending" || !toolResultId || !sessionId) {
        return;
      }

      await fetch(`/api/chat/tool-results/${toolResultId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          status: "pending",
          meeting_draft: {
            ...nextDraft,
            project_id: nextProjectId || undefined,
          },
        }),
      });
    },
    [sessionId, status, toolResultId]
  );

  useEffect(() => {
    if (!draft || status !== "pending") {
      return;
    }

    const handle = window.setTimeout(() => {
      void persistPendingDraft(draft, projectId);
    }, 400);

    return () => window.clearTimeout(handle);
  }, [draft, persistPendingDraft, projectId, status]);

  if (!draft) {
    return null;
  }

  if (status === "success" || savedMeetingId) {
    const meetingId =
      savedMeetingId ??
      (tool.output &&
      typeof tool.output === "object" &&
      "meeting_record" in tool.output &&
      (tool.output as { meeting_record?: { id?: string } }).meeting_record?.id
        ? (tool.output as { meeting_record: { id: string } }).meeting_record.id
        : null);

    return (
      <Card size="sm" className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader>
          <CardTitle>Meeting confirmed</CardTitle>
          <CardDescription>
            {draft.title} saved{meetingId ? ` (${meetingId.slice(0, 8)}…)` : ""}.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status === "dismissed") {
    return null;
  }

  async function handleConfirm() {
    if (!draft) {
      return;
    }

    if (!projectId) {
      setError("Select a project before confirming.");
      return;
    }

    if (!sessionId) {
      setError("Chat session is unavailable. Refresh and try again.");
      return;
    }

    const participants = participantsText
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    const payload: MeetingDraft = {
      title: draft.title,
      date: toIsoDate(toDateInputValue(draft.date)),
      participants,
      notes_preview: draft.notes_preview,
      project_id: projectId,
      source_text: draft.source_text,
      intake_kind: draft.intake_kind,
    };

    setPending(confirmKey, true);
    setError(null);

    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-chat-session-id": sessionId,
        },
        body: JSON.stringify({
          meeting_draft: payload,
          project_id: projectId,
          tool_result_id: toolResultId,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { detail?: string }
          | null;
        throw new Error(data?.detail ?? "Could not save meeting");
      }

      const record = (await response.json()) as { id: string };
      setSavedMeetingId(record.id);
      onUpdated?.();
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "Could not save meeting"
      );
      setPending(confirmKey, false);
    }
  }

  async function handleDismiss() {
    if (!toolResultId || !sessionId) {
      return;
    }

    await fetch(`/api/chat/tool-results/${toolResultId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, status: "dismissed" }),
    });
    onUpdated?.();
  }

  return (
    <Card size="sm" className="max-w-2xl">
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Confirm meeting</CardTitle>
            <CardDescription>
              Review extracted details before saving to your project.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss meeting confirmation"
            onClick={() => void handleDismiss()}
            disabled={confirming}
          >
            <X className="size-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`meeting-title-${messageId}`}>Title</Label>
            <Input
              id={`meeting-title-${messageId}`}
              value={draft.title}
              onChange={(event) =>
                setDraft((current) =>
                  current ? { ...current, title: event.target.value } : current
                )
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`meeting-date-${messageId}`}>Date</Label>
            <Input
              id={`meeting-date-${messageId}`}
              type="date"
              value={toDateInputValue(draft.date)}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? { ...current, date: toIsoDate(event.target.value) }
                    : current
                )
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`meeting-project-${messageId}`}>Project</Label>
            <Select
              value={projectId}
              onValueChange={setProjectId}
              disabled={consultationsLoading || consultations.length === 0}
            >
              <SelectTrigger id={`meeting-project-${messageId}`}>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {consultations.map((consultation) => (
                  <SelectItem key={consultation.id} value={consultation.id}>
                    {consultation.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`meeting-participants-${messageId}`}>
              Participants
            </Label>
            <Input
              id={`meeting-participants-${messageId}`}
              value={participantsText}
              placeholder="Comma-separated names"
              onChange={(event) => setParticipantsText(event.target.value)}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`meeting-notes-${messageId}`}>Notes preview</Label>
            <Textarea
              id={`meeting-notes-${messageId}`}
              value={draft.notes_preview}
              rows={4}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? { ...current, notes_preview: event.target.value }
                    : current
                )
              }
            />
          </div>
        </div>

        {draft.intake_kind ? (
          <Badge variant="secondary" className="capitalize">
            {draft.intake_kind} intake
          </Badge>
        ) : null}
      </CardContent>

      <CardFooter className="justify-end gap-2 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleDismiss()}
          disabled={confirming}
        >
          Dismiss
        </Button>
        <Button type="button" onClick={() => void handleConfirm()} disabled={confirming}>
          {confirming ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Confirming…
            </>
          ) : (
            "Confirm meeting"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

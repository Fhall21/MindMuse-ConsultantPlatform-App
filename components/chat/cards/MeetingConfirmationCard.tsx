"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { MeetingTypeSelect } from "@/components/meetings/meeting-type-select";
import { PeopleField } from "@/components/meetings/people-field";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { ChatToolCardShell } from "@/components/chat/cards/chat-tool-card-shell";
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
import { useConsultations } from "@/hooks/use-consultations";
import { useMeetingTypes } from "@/hooks/use-meeting-types";
import { usePeople } from "@/hooks/use-people";
import type { MeetingDraft } from "@/lib/chat/tools/intake";
import { buildMeetingTitle } from "@/lib/meeting-title";
import {
  CARD_DISMISSED_COPY,
  CARD_REOPEN_HELP,
  meetingSavedDescription,
} from "@/lib/chat/onboarding-copy";
import { toDateInputValue, toIsoDate } from "@/lib/meetings/meeting-date";
import { splitParticipantSuggestions } from "@/lib/meetings/participant-suggestions";
import type { Consultation, Person } from "@/types/db";
import { readMeetingDraft, type ChatCardProps } from "./types";

/** Stable fallbacks while react-query data is undefined (avoids `= []` new ref each render). */
const EMPTY_CONSULTATIONS: Consultation[] = [];
const EMPTY_PEOPLE: Person[] = [];

function samePersonIds(left: Person[], right: Person[]): boolean {
  return (
    left.length === right.length &&
    left.every((person, index) => person.id === right[index]?.id)
  );
}

function sameStringList(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function buildPersistedDraft(params: {
  title: string;
  meetingDate: string;
  selectedPeople: Person[];
  meetingTypeId: string;
  projectId: string;
  sourceText?: string;
  intakeKind?: MeetingDraft["intake_kind"];
}): MeetingDraft {
  return {
    title: params.title.trim(),
    date: toIsoDate(params.meetingDate),
    participants: params.selectedPeople.map((person) => person.name),
    person_ids: params.selectedPeople.map((person) => person.id),
    meeting_type_id: params.meetingTypeId || undefined,
    notes_preview: "",
    project_id: params.projectId,
    source_text: params.sourceText,
    intake_kind: params.intakeKind,
  };
}

export function MeetingConfirmationCard({
  tool,
  messageId,
  sessionId,
  onUpdated,
}: ChatCardProps) {
  const initialDraft = useMemo(() => readMeetingDraft(tool.output), [tool.output]);
  const { data: consultations = EMPTY_CONSULTATIONS, isLoading: consultationsLoading } =
    useConsultations();
  const { data: meetingTypes = [] } = useMeetingTypes();
  const { data: allPeople = EMPTY_PEOPLE } = usePeople();
  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `confirm-meeting:${messageId}`;

  const [projectId, setProjectId] = useState(
    initialDraft?.project_id ?? consultations[0]?.id ?? ""
  );
  const [meetingTypeId, setMeetingTypeId] = useState(initialDraft?.meeting_type_id ?? "");
  const [meetingDate, setMeetingDate] = useState(
    initialDraft ? toDateInputValue(initialDraft.date) : new Date().toISOString().slice(0, 10)
  );
  const [selectedPeople, setSelectedPeople] = useState<Person[]>([]);
  const [suggestedExistingPeople, setSuggestedExistingPeople] = useState<Person[]>([]);
  const [suggestedNewNames, setSuggestedNewNames] = useState<string[]>([]);
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMeetingId, setSavedMeetingId] = useState<string | null>(null);
  const autoFilledPeopleRef = useRef(false);
  const confirming = isPending(confirmKey);
  const status = tool.status ?? "pending";
  const toolResultId = tool.toolResultId;

  useEffect(() => {
    if (!initialDraft) {
      return;
    }

    if (initialDraft.project_id) {
      setProjectId((current) =>
        current === initialDraft.project_id ? current : initialDraft.project_id!
      );
    }
    if (initialDraft.meeting_type_id) {
      setMeetingTypeId((current) =>
        current === initialDraft.meeting_type_id ? current : initialDraft.meeting_type_id!
      );
    }
    const nextMeetingDate = toDateInputValue(initialDraft.date);
    setMeetingDate((current) => (current === nextMeetingDate ? current : nextMeetingDate));

    const { suggestedExisting, suggestedNewNames: unmatchedNames } =
      splitParticipantSuggestions(initialDraft.participants, allPeople);
    setSuggestedExistingPeople((current) =>
      samePersonIds(current, suggestedExisting) ? current : suggestedExisting
    );
    setSuggestedNewNames((current) =>
      sameStringList(current, unmatchedNames) ? current : unmatchedNames
    );

    if (!autoFilledPeopleRef.current && suggestedExisting.length > 0) {
      autoFilledPeopleRef.current = true;
      setSelectedPeople((current) => {
        const selectedIds = new Set(current.map((person) => person.id));
        const toAdd = suggestedExisting.filter((person) => !selectedIds.has(person.id));
        return toAdd.length > 0 ? [...current, ...toAdd] : current;
      });
    }
  }, [allPeople, initialDraft]);

  useEffect(() => {
    if (!projectId && consultations[0]?.id) {
      setProjectId(consultations[0].id);
    }
  }, [consultations, projectId]);

  useEffect(() => {
    if (!initialDraft?.suggested_type_code || meetingTypeId || meetingTypes.length === 0) {
      return;
    }

    const matched = meetingTypes.find((type) => type.code === initialDraft.suggested_type_code);
    if (matched) {
      setMeetingTypeId(matched.id);
    }
  }, [initialDraft?.suggested_type_code, meetingTypeId, meetingTypes]);

  const selectedType = meetingTypes.find((type) => type.id === meetingTypeId);
  const generatedTitle = useMemo(() => {
    const firstNames = selectedPeople.map((person) => person.name.split(/\s+/)[0]);
    const date = meetingDate ? new Date(`${meetingDate}T12:00:00`) : null;
    return buildMeetingTitle(selectedType?.code, firstNames, date);
  }, [meetingDate, selectedPeople, selectedType?.code]);

  useEffect(() => {
    if (!titleManuallyEdited) {
      setTitle((current) => (current === generatedTitle ? current : generatedTitle));
    }
  }, [generatedTitle, titleManuallyEdited]);

  const persistPendingDraft = useCallback(
    async (nextDraft: MeetingDraft) => {
      if (status !== "pending" || !toolResultId || !sessionId) {
        return;
      }

      await fetch(`/api/chat/tool-results/${toolResultId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          status: "pending",
          meeting_draft: nextDraft,
        }),
      });
    },
    [sessionId, status, toolResultId]
  );

  useEffect(() => {
    if (status !== "pending" || !projectId) {
      return;
    }

    const handle = window.setTimeout(() => {
      void persistPendingDraft(
        buildPersistedDraft({
          title,
          meetingDate,
          selectedPeople,
          meetingTypeId,
          projectId,
          sourceText: initialDraft?.source_text,
          intakeKind: initialDraft?.intake_kind,
        })
      );
    }, 400);

    return () => window.clearTimeout(handle);
  }, [
    initialDraft?.intake_kind,
    initialDraft?.source_text,
    meetingDate,
    meetingTypeId,
    persistPendingDraft,
    projectId,
    selectedPeople,
    status,
    title,
  ]);

  if (!initialDraft) {
    return null;
  }

  if (status === "success" || savedMeetingId) {
    const displayTitle = title || initialDraft.title;

    return (
      <ChatToolCardShell
        success
        title="Meeting saved"
        description={meetingSavedDescription(displayTitle)}
        successHelp={CARD_REOPEN_HELP}
      />
    );
  }

  if (status === "dismissed") {
    return (
      <ChatToolCardShell
        dismissed
        title="Meeting review dismissed"
        description={CARD_DISMISSED_COPY}
      />
    );
  }

  async function handleConfirm() {
    if (!projectId) {
      setError("Select a consultation before confirming.");
      return;
    }

    if (selectedPeople.length === 0) {
      setError("Add at least one person before confirming.");
      return;
    }

    if (!title.trim()) {
      setError("A meeting title is required.");
      return;
    }

    if (!sessionId) {
      setError("Chat session is unavailable. Refresh and try again.");
      return;
    }

    const payload = buildPersistedDraft({
      title,
      meetingDate,
      selectedPeople,
      meetingTypeId,
      projectId,
      sourceText: initialDraft?.source_text,
      intakeKind: initialDraft?.intake_kind,
    });

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
      setPending(confirmKey, false);
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
    <Card size="sm" className="max-w-xl">
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Confirm meeting</CardTitle>
            <CardDescription>
              Review extracted details before saving to your consultation.
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

      <CardContent className="space-y-5 pt-4">
        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor={`meeting-project-${messageId}`}>Consultation</Label>
          <p className="text-xs text-muted-foreground">
            Choose the consultation project this meeting belongs to.
          </p>
          <Select
            value={projectId || undefined}
            onValueChange={(value) => {
              setProjectId((current) => (current === value ? current : value));
            }}
            disabled={consultationsLoading || consultations.length === 0}
          >
            <SelectTrigger id={`meeting-project-${messageId}`} className="h-9">
              <SelectValue placeholder="Select consultation" />
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

        <MeetingTypeSelect
          id={`meeting-type-${messageId}`}
          value={meetingTypeId}
          onChange={setMeetingTypeId}
        />

        <div className="space-y-2">
          <Label htmlFor={`meeting-date-${messageId}`}>Date</Label>
          <Input
            id={`meeting-date-${messageId}`}
            type="date"
            value={meetingDate}
            onChange={(event) => setMeetingDate(event.target.value)}
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label>People</Label>
          <PeopleField
            selected={selectedPeople}
            onAdd={(person) =>
              setSelectedPeople((current) =>
                current.some((entry) => entry.id === person.id)
                  ? current
                  : [...current, person]
              )
            }
            onRemove={(id) =>
              setSelectedPeople((current) => current.filter((person) => person.id !== id))
            }
            suggestedExisting={suggestedExistingPeople}
            onDismissSuggestedExisting={(id) =>
              setSuggestedExistingPeople((current) => current.filter((person) => person.id !== id))
            }
            suggestedNewNames={suggestedNewNames}
            onDismissSuggestedNew={(name) =>
              setSuggestedNewNames((current) => current.filter((entry) => entry !== name))
            }
          />
          {selectedPeople.length === 0 ? (
            <p className="text-xs text-muted-foreground">At least one person is required.</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={`meeting-title-${messageId}`}>Title</Label>
            {titleManuallyEdited ? (
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={() => {
                  setTitleManuallyEdited(false);
                  setTitle(generatedTitle);
                }}
              >
                Reset to generated
              </button>
            ) : null}
          </div>
          <Input
            id={`meeting-title-${messageId}`}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setTitleManuallyEdited(true);
            }}
            placeholder="Meeting title"
            className="h-9 text-sm"
          />
          {!titleManuallyEdited && !title ? (
            <p className="text-xs text-muted-foreground">
              Select a type, people, or date to auto-generate a title.
            </p>
          ) : null}
        </div>
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
        <Button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={confirming || !title.trim() || selectedPeople.length === 0}
        >
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

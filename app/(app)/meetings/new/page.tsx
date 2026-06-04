"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { MEETINGS_QUERY_KEY } from "@/hooks/use-meetings";
import { toast } from "sonner";
import { X, Plus, ChevronDown, FileText, PenLine, Upload } from "lucide-react";
import { MeetingTypeSelect } from "@/components/meetings/meeting-type-select";
import { PeopleField } from "@/components/meetings/people-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createMeeting, updateTranscript } from "@/lib/actions/consultations";
import { useConsultations } from "@/hooks/use-consultations";
import { useMeetingTypes } from "@/hooks/use-meeting-types";
import { usePeople } from "@/hooks/use-people";
import { buildMeetingTitle } from "@/lib/meeting-title";
import { splitParticipantSuggestions } from "@/lib/meetings/participant-suggestions";
import {
  parseTranscriptFile,
  TRANSCRIPT_ACCEPTED_ATTR,
} from "@/lib/transcript-file-parser";
import type { Person } from "@/types/db";
import posthog from "posthog-js";

// ─── Consultation combobox ────────────────────────────────────────────────────

function ConsultationField({
  value,
  onChange,
  newLabel,
  onNewLabelChange,
}: {
  value: string;
  onChange: (id: string) => void;
  newLabel: string;
  onNewLabelChange: (v: string) => void;
}) {
  const { data: consultations = [] } = useConsultations();
  const [creating, setCreating] = useState(false);

  if (creating) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={newLabel}
          onChange={(e) => onNewLabelChange(e.target.value)}
          placeholder="Project name"
          className="h-9 flex-1 text-sm"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
            if (e.key === "Escape") {
              onNewLabelChange("");
              setCreating(false);
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="default"
          className="h-9 px-3 text-xs"
          disabled={!newLabel.trim()}
          onClick={() => setCreating(false)}
        >
          Done
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9 px-2 text-xs text-muted-foreground"
          onClick={() => {
            onNewLabelChange("");
            setCreating(false);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">No project</option>
          {consultations.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-9 shrink-0 text-xs"
        onClick={() => {
          onChange("");
          setCreating(true);
        }}
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        New
      </Button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Mode = "choose" | "transcript" | "manual";

export default function NewMeetingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("choose");
  const [submitting, setSubmitting] = useState(false);

  // Transcript mode state
  const [transcriptText, setTranscriptText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: meetingTypes = [] } = useMeetingTypes();
  const { data: allPeople = [] } = usePeople();

  // Suggestion state (populated after transcript extraction)
  const [suggestedExistingPeople, setSuggestedExistingPeople] = useState<Person[]>([]);
  const [suggestedNewNames, setSuggestedNewNames] = useState<string[]>([]);

  // Form state
  const [consultationId, setConsultationId] = useState(searchParams.get("consultationId") ?? "");
  const [newConsultationLabel, setNewConsultationLabel] = useState("");
  const [meetingTypeId, setMeetingTypeId] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [selectedPeople, setSelectedPeople] = useState<Person[]>([]);
  const [title, setTitle] = useState("");
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);

  // Auto-generate title
  const selectedType = meetingTypes.find((t) => t.id === meetingTypeId);
  const generatedTitle = useMemo(() => {
    const firstNames = selectedPeople.map((p) => p.name.split(/\s+/)[0]);
    const date = meetingDate ? new Date(meetingDate + "T12:00:00") : null;
    return buildMeetingTitle(selectedType?.code, firstNames, date);
  }, [selectedType, selectedPeople, meetingDate]);

  useEffect(() => {
    if (!titleManuallyEdited) {
      setTitle(generatedTitle);
    }
  }, [generatedTitle, titleManuallyEdited]);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await parseTranscriptFile(file);
      setTranscriptText(text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read file");
    }
    // Reset so the same file can be selected again
    e.target.value = "";
  }

  async function handleExtract() {
    if (!transcriptText.trim()) return;
    setExtracting(true);
    try {
      const res = await fetch("/api/infer/meeting-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcriptText,
          meeting_type_codes: meetingTypes.map((t) => t.code),
        }),
      });
      if (!res.ok) throw new Error("Extraction failed");
      const data = await res.json();

      // Pre-fill meeting type
      if (data.suggested_type_code) {
        const matched = meetingTypes.find(
          (t) => t.code === data.suggested_type_code
        );
        if (matched) setMeetingTypeId(matched.id);
      }

      // Pre-fill date
      if (data.suggested_date) {
        setMeetingDate(data.suggested_date);
      }

      // Match suggested people against existing ones
      if (data.suggested_people?.length) {
        const names: string[] = data.suggested_people
          .map((n: unknown) => (typeof n === "string" ? n.trim() : ""))
          .filter(Boolean);

        if (names.length > 0) {
          const { suggestedExisting, suggestedNewNames: unmatched } =
            splitParticipantSuggestions(names, allPeople);
          setSuggestedExistingPeople(suggestedExisting);
          setSuggestedNewNames(unmatched);
        }
      }

      setMode("manual");
    } catch {
      toast.error(
        "Could not extract details from the transcript. You can fill them in manually."
      );
      setMode("manual");
    } finally {
      setExtracting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("A meeting title is required");
      return;
    }
    if (selectedPeople.length === 0) {
      toast.error("At least one person is required");
      return;
    }
    setSubmitting(true);
    try {
      const id = await createMeeting({
        title: title.trim(),
        consultationId: consultationId || undefined,
        newConsultationLabel: newConsultationLabel || undefined,
        meetingTypeId: meetingTypeId || undefined,
        meetingDate: meetingDate ? new Date(meetingDate + "T12:00:00") : undefined,
        personIds: selectedPeople.map((p) => p.id),
      });

      // Save transcript text if we came from the transcript flow
      if (transcriptText.trim()) {
        try {
          await updateTranscript({ id, transcriptRaw: transcriptText });
        } catch {
          // Non-fatal — transcript can be added later
        }
      }

      posthog.capture("meeting_created", {
        has_transcript: Boolean(transcriptText.trim()),
        has_consultation: Boolean(consultationId || newConsultationLabel),
        has_meeting_type: Boolean(meetingTypeId),
        person_count: selectedPeople.length,
        intake_mode: mode,
      });

      queryClient.invalidateQueries({ queryKey: MEETINGS_QUERY_KEY });
      router.push(`/meetings/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create meeting");
      posthog.captureException(err instanceof Error ? err : new Error("Failed to create meeting"));
      setSubmitting(false);
    }
  }

  // ── Mode: choose ────────────────────────────────────────────────────────────

  if (mode === "choose") {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">New Meeting</h1>
          <p className="text-sm text-muted-foreground">
            How would you like to start?
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode("transcript")}
            className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50 hover:border-foreground/20"
          >
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">Start from transcript</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Paste or upload — details extracted automatically
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode("manual")}
            className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50 hover:border-foreground/20"
          >
            <PenLine className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">Enter manually</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Fill in the form directly
              </p>
            </div>
          </button>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => router.push("/meetings")}
        >
          Cancel
        </Button>
      </div>
    );
  }

  // ── Mode: transcript ─────────────────────────────────────────────────────────

  if (mode === "transcript") {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">New Meeting</h1>
          <p className="text-sm text-muted-foreground">
            Paste your transcript or upload a file to extract meeting details.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Transcript</Label>
            <Textarea
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Paste transcript text here…"
              className="min-h-[200px] resize-y font-mono text-xs"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept={TRANSCRIPT_ACCEPTED_ATTR}
              className="hidden"
              onChange={handleFileSelected}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload file
            </Button>
            <span className="text-xs text-muted-foreground">
              .txt, .md, .vtt, .docx
            </span>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button
              type="button"
              disabled={!transcriptText.trim() || extracting}
              onClick={handleExtract}
            >
              {extracting ? "Extracting…" : "Extract details"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setMode("manual")}
            >
              Skip, enter manually
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Mode: manual ─────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">New Meeting</h1>
        {transcriptText ? (
          <p className="text-sm text-muted-foreground">
            Review the extracted details and adjust as needed.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Create the record first. Add material after.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Consultation */}
        <div className="space-y-2">
          <Label>Project</Label>
          <p className="text-xs text-muted-foreground">
            Choose the project this meeting belongs to.
          </p>
          <ConsultationField
            value={consultationId}
            onChange={setConsultationId}
            newLabel={newConsultationLabel}
            onNewLabelChange={setNewConsultationLabel}
          />
          {newConsultationLabel && (
            <p className="text-xs text-muted-foreground">
              A new project &ldquo;{newConsultationLabel}&rdquo; will be created.
            </p>
          )}
        </div>

        <MeetingTypeSelect value={meetingTypeId} onChange={setMeetingTypeId} />

        {/* Date */}
        <div className="space-y-2">
          <Label htmlFor="meetingDate">Date</Label>
          <Input
            id="meetingDate"
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            className="h-9 text-sm"
          />
        </div>

        {/* People */}
        <div className="space-y-2">
          <Label>People</Label>
          <PeopleField
            selected={selectedPeople}
            onAdd={(p) => setSelectedPeople((prev) => [...prev, p])}
            onRemove={(id) =>
              setSelectedPeople((prev) => prev.filter((p) => p.id !== id))
            }
            suggestedExisting={suggestedExistingPeople}
            onDismissSuggestedExisting={(id) =>
              setSuggestedExistingPeople((prev) => prev.filter((p) => p.id !== id))
            }
            suggestedNewNames={suggestedNewNames}
            onDismissSuggestedNew={(name) =>
              setSuggestedNewNames((prev) => prev.filter((n) => n !== name))
            }
          />
          {selectedPeople.length === 0 && (
            <p className="text-xs text-muted-foreground">
              At least one person is required.
            </p>
          )}
        </div>

        {/* Title — derived but editable */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="title">Title</Label>
            {titleManuallyEdited && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                onClick={() => {
                  setTitleManuallyEdited(false);
                  setTitle(generatedTitle);
                }}
              >
                Reset to generated
              </button>
            )}
          </div>
          <Input
            id="title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleManuallyEdited(true);
            }}
            placeholder="Meeting title"
            className="h-9 text-sm"
          />
          {!titleManuallyEdited && !title && (
            <p className="text-xs text-muted-foreground">
              Select a type, people, or date to auto-generate a title.
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={submitting || !title.trim() || selectedPeople.length === 0}>
            {submitting ? "Creating…" : "Create meeting"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/meetings")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}


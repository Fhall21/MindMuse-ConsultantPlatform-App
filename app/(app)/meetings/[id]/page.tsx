"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AuditTrail } from "@/components/audit/audit-trail";
import { ThemePanel } from "@/components/consultations/theme-panel";
import { EmailDraftPanel } from "@/components/evidence/email-draft-panel";
import { TranscriptIntakePanel } from "@/components/consultations/transcript-intake-panel";
import { OcrReviewPanel } from "@/components/consultations/ocr-review-panel";
import { NotesEditor } from "@/components/consultations/notes-editor";
import { PeoplePanel } from "@/components/consultations/people-panel";
import { RoundsPanel } from "@/components/consultations/rounds-panel";
import { useMeeting } from "@/hooks/use-meetings";
import { useConsultations } from "@/hooks/use-consultations";
import { useMeetingTypes } from "@/hooks/use-meeting-types";
import {
  markMeetingComplete,
  updateMeetingTitle,
  updateMeetingFields,
} from "@/lib/actions/consultations";
import { buildMeetingTitle } from "@/lib/meeting-title";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h2>
  );
}

export default function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useMeeting(id);
  const { data: rounds } = useConsultations();
  const { data: meetingTypes = [] } = useMeetingTypes();

  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [savingFields, setSavingFields] = useState(false);

  const meeting = data?.meeting;
  const isDraft = meeting?.status === "draft";

  const currentConsultation = rounds?.find((consultation) => consultation.id === meeting?.consultation_id) ?? null;
  const normalizedSavedTitle = meeting?.title.trim() ?? "";
  const normalizedDraftTitle = titleDraft.trim();
  const titleChanged = normalizedDraftTitle !== normalizedSavedTitle;
  const titleInvalid = normalizedDraftTitle.length === 0 || normalizedDraftTitle.length > 255;

  useEffect(() => {
    setTitleDraft(meeting?.title ?? "");
  }, [meeting?.title]);

  async function handleMarkComplete() {
    setCompleting(true);
    try {
      await markMeetingComplete(id);
      await queryClient.invalidateQueries({ queryKey: ["meetings", id] });
      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
      setConfirmCompleteOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to mark meeting as complete.");
    } finally {
      setCompleting(false);
    }
  }

  async function handleSaveTitle() {
    if (!meeting || savingTitle || !titleChanged || titleInvalid) return;

    setSavingTitle(true);
    try {
      await updateMeetingTitle({ id, title: titleDraft });
      await queryClient.invalidateQueries({ queryKey: ["meetings", id] });
      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Meeting title updated.");
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to update meeting title.";
      toast.error(message);
    } finally {
      setSavingTitle(false);
    }
  }

  async function handleSaveFields(opts: { meetingTypeId?: string | null; meetingDate?: Date | null }) {
    if (!meeting) return;
    setSavingFields(true);
    try {
      await updateMeetingFields({ id, ...opts });
      await queryClient.invalidateQueries({ queryKey: ["meetings", id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update meeting.");
    } finally {
      setSavingFields(false);
    }
  }

  function handleRegenerateTitle() {
    if (!meeting) return;
    const selectedType = meetingTypes.find((t) => t.id === meeting.meeting_type_id);
    // We don't have people's names readily here; use empty for now
    const date = meeting.meeting_date ? new Date(meeting.meeting_date) : null;
    const generated = buildMeetingTitle(selectedType?.code, [], date);
    if (generated) setTitleDraft(generated);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">
          Failed to load meeting. It may not exist or you may not have access.
        </p>
        <Button variant="ghost" asChild>
          <Link href="/meetings">Back to meetings</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <nav className="text-sm text-muted-foreground">
          <Link href="/meetings" className="hover:text-foreground">
            Meetings
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{normalizedSavedTitle}</span>
        </nav>

        <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="space-y-2">
                <label
                  htmlFor="meeting-title"
                  className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  Meeting title
                </label>
                <Input
                  id="meeting-title"
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSaveTitle();
                    }
                  }}
                  placeholder="Enter meeting title"
                  className="h-11 text-base font-semibold sm:text-lg"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveTitle}
                  disabled={!titleChanged || titleInvalid || savingTitle}
                >
                  {savingTitle ? "Saving…" : "Save title"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTitleDraft(meeting.title)}
                  disabled={!titleChanged || savingTitle}
                >
                  Reset
                </Button>
                <span className="text-xs text-muted-foreground">
                  {titleInvalid
                    ? "Title must be between 1 and 255 characters."
                    : titleChanged
                      ? "Unsaved title changes"
                      : "Title saved"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Badge variant={isDraft ? "outline" : "secondary"}>
                {isDraft ? "Draft" : "Complete"}
              </Badge>
              {isDraft && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmCompleteOpen(true)}
                >
                  Mark complete
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Consultation
              </p>
              <RoundsPanel
                meetingId={id}
                currentRoundId={meeting.consultation_id}
                currentRoundLabel={currentConsultation?.label ?? null}
              />
            </div>

            {/* Meeting type */}
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Meeting Type
              </p>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-xs">
                  <select
                    value={meeting.meeting_type_id ?? ""}
                    onChange={(e) =>
                      handleSaveFields({ meetingTypeId: e.target.value || null })
                    }
                    disabled={savingFields}
                    className="flex h-8 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 pr-7 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <option value="">Not set</option>
                    {meetingTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-muted-foreground"
                  title="Regenerate title from type and date"
                  onClick={handleRegenerateTitle}
                >
                  Regenerate title
                </Button>
              </div>
            </div>

            {/* Meeting date */}
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Date
              </p>
              <Input
                type="date"
                defaultValue={
                  meeting.meeting_date
                    ? new Date(meeting.meeting_date).toISOString().slice(0, 10)
                    : ""
                }
                onBlur={(e) =>
                  handleSaveFields({
                    meetingDate: e.target.value ? new Date(e.target.value + "T12:00:00") : null,
                  })
                }
                disabled={savingFields}
                className="h-8 w-48 text-sm"
              />
            </div>

            {!isDraft && meeting.consultation_id ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/consultations/rounds/${meeting.consultation_id}`}>
                    Open consultation workspace &rarr;
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/canvas/round/${meeting.consultation_id}`}>
                    Evidence canvas &rarr;
                  </Link>
                </Button>
                <span className="text-xs text-muted-foreground">
                  View theme grouping, synthesis, and consultation outputs
                </span>
              </div>
            ) : null}

            <div className="space-y-2 border-t pt-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  People
                </p>
                <p className="text-xs text-muted-foreground">
                  Link people before audio transcription so the expected speaker count is clear.
                </p>
              </div>
              <PeoplePanel meetingId={id} />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Transcript intake — paste, file upload, or audio transcription */}
      <section className="space-y-3">
        <SectionHeading>Transcript</SectionHeading>
        <TranscriptIntakePanel
          meetingId={id}
          initialTranscript={meeting.transcript_raw}
          readOnly={!isDraft}
        />
      </section>

      <Separator />

      {/* Handwritten notes OCR */}
      <section className="space-y-3">
        <SectionHeading>Handwritten notes photo</SectionHeading>
        <OcrReviewPanel meetingId={id} />
      </section>

      <Separator />

      {/* Notes */}
      <section className="space-y-3">
        <SectionHeading>Notes</SectionHeading>
        <NotesEditor
          meetingId={id}
          initialValue={meeting.notes}
          readOnly={!isDraft}
        />
      </section>

      <Separator />

      {/* Themes — Agent 4 slot */}
      <section className="space-y-3">
        <SectionHeading>Themes</SectionHeading>
        <ThemePanel meetingId={id} />
      </section>

      <Separator />

      {/* Evidence Email — Agent 4 slot */}
      <section className="space-y-3">
        <SectionHeading>Evidence Email</SectionHeading>
        <EmailDraftPanel meetingId={id} />
      </section>

      <Separator />

      {/* Audit Trail — Agent 4 slot */}
      <section className="space-y-3">
        <SectionHeading>Audit Trail</SectionHeading>
        <AuditTrail meetingId={id} />
      </section>

      {/* Mark Complete confirmation */}
      <Dialog open={confirmCompleteOpen} onOpenChange={setConfirmCompleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark as complete?</DialogTitle>
            <DialogDescription>
              This cannot be undone. The transcript will become read-only.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmCompleteOpen(false)}
              disabled={completing}
            >
              Cancel
            </Button>
            <Button onClick={handleMarkComplete} disabled={completing}>
              {completing ? "Saving…" : "Mark complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

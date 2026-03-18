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
import { useConsultation, useConsultationRounds } from "@/hooks/use-consultations";
import {
  markConsultationComplete,
  updateConsultationTitle,
} from "@/lib/actions/consultations";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h2>
  );
}

export default function ConsultationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useConsultation(id);
  const { data: rounds } = useConsultationRounds();

  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  const consultation = data?.consultation;
  const isDraft = consultation?.status === "draft";

  const currentRound = rounds?.find((r) => r.id === consultation?.round_id) ?? null;
  const normalizedSavedTitle = consultation?.title.trim() ?? "";
  const normalizedDraftTitle = titleDraft.trim();
  const titleChanged = normalizedDraftTitle !== normalizedSavedTitle;
  const titleInvalid = normalizedDraftTitle.length === 0 || normalizedDraftTitle.length > 255;

  useEffect(() => {
    setTitleDraft(consultation?.title ?? "");
  }, [consultation?.title]);

  async function handleMarkComplete() {
    setCompleting(true);
    try {
      await markConsultationComplete(id);
      queryClient.invalidateQueries({ queryKey: ["consultations", id] });
      setConfirmCompleteOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to mark consultation as complete.");
    } finally {
      setCompleting(false);
    }
  }

  async function handleSaveTitle() {
    if (!consultation || savingTitle || !titleChanged || titleInvalid) return;

    setSavingTitle(true);
    try {
      await updateConsultationTitle({ id, title: titleDraft });
      await queryClient.invalidateQueries({ queryKey: ["consultations", id] });
      toast.success("Consultation title updated.");
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to update consultation title.";
      toast.error(message);
    } finally {
      setSavingTitle(false);
    }
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

  if (error || !consultation) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">
          Failed to load consultation. It may not exist or you may not have access.
        </p>
        <Button variant="ghost" asChild>
          <Link href="/consultations">Back to consultations</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <nav className="text-sm text-muted-foreground">
          <Link href="/consultations" className="hover:text-foreground">
            Consultations
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{normalizedSavedTitle}</span>
        </nav>

        <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="space-y-2">
                <label
                  htmlFor="consultation-title"
                  className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  Consultation title
                </label>
                <Input
                  id="consultation-title"
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleSaveTitle();
                    }
                  }}
                  placeholder="Enter consultation title"
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
                  onClick={() => setTitleDraft(consultation.title)}
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

          <div className="space-y-3 border-t pt-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Round
              </p>
              <RoundsPanel
                consultationId={id}
                currentRoundId={consultation.round_id}
                currentRoundLabel={currentRound?.label ?? null}
              />
            </div>

            {consultation.round_id ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/consultations/rounds/${consultation.round_id}`}>
                    Open round workspace &rarr;
                  </Link>
                </Button>
                <span className="text-xs text-muted-foreground">
                  View theme grouping, synthesis, and round outputs
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Separator />

      {/* Transcript intake — paste, file upload, or audio transcription */}
      <section className="space-y-3">
        <SectionHeading>Transcript</SectionHeading>
        <TranscriptIntakePanel
          consultationId={id}
          initialTranscript={consultation.transcript_raw}
          readOnly={!isDraft}
        />
      </section>

      <Separator />

      {/* Handwritten notes OCR */}
      <section className="space-y-3">
        <SectionHeading>Handwritten notes photo</SectionHeading>
        <OcrReviewPanel consultationId={id} />
      </section>

      <Separator />

      {/* Notes */}
      <section className="space-y-3">
        <SectionHeading>Notes</SectionHeading>
        <NotesEditor
          consultationId={id}
          initialValue={consultation.notes}
          readOnly={!isDraft}
        />
      </section>

      <Separator />

      {/* People */}
      <section className="space-y-3">
        <SectionHeading>People</SectionHeading>
        <PeoplePanel consultationId={id} />
      </section>

      <Separator />

      {/* Themes — Agent 4 slot */}
      <section className="space-y-3">
        <SectionHeading>Themes</SectionHeading>
        <ThemePanel consultationId={id} />
      </section>

      <Separator />

      {/* Evidence Email — Agent 4 slot */}
      <section className="space-y-3">
        <SectionHeading>Evidence Email</SectionHeading>
        <EmailDraftPanel consultationId={id} />
      </section>

      <Separator />

      {/* Audit Trail — Agent 4 slot */}
      <section className="space-y-3">
        <SectionHeading>Audit Trail</SectionHeading>
        <AuditTrail consultationId={id} />
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

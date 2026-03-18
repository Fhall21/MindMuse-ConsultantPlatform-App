"use client";

import { use, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { markConsultationComplete } from "@/lib/actions/consultations";

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

  const consultation = data?.consultation;
  const isDraft = consultation?.status === "draft";

  const currentRound = rounds?.find((r) => r.id === consultation?.round_id) ?? null;

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
      <div className="space-y-3">
        <nav className="text-sm text-muted-foreground">
          <Link href="/consultations" className="hover:text-foreground">
            Consultations
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{consultation.title}</span>
        </nav>

        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            {consultation.title}
          </h1>

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

      {/* Round */}
      <section className="space-y-3">
        <SectionHeading>Round</SectionHeading>
        <RoundsPanel
          consultationId={id}
          currentRoundId={consultation.round_id}
          currentRoundLabel={currentRound?.label ?? null}
        />
        {consultation.round_id ? (
          <div className="flex items-center gap-2">
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

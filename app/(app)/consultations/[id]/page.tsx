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
import { TranscriptEditor } from "@/components/consultations/transcript-editor";
import { PeoplePanel } from "@/components/consultations/people-panel";
import { RoundsPanel } from "@/components/consultations/rounds-panel";
import { useConsultation, useConsultationRounds } from "@/hooks/use-consultations";
import { markConsultationComplete } from "@/lib/actions/consultations";

// Expected: <ThemePanel consultationId={string} />
// TODO: replace stub with import from components/consultations/theme-panel.tsx when Agent 4 branch merges
function ThemePanel({ consultationId: _id }: { consultationId: string }) {
  return (
    <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">
      Theme panel — pending Agent 4
    </div>
  );
}

// Expected: <EmailDraftPanel consultationId={string} />
// TODO: replace stub with import from components/evidence/email-draft-panel.tsx when Agent 4 branch merges
function EmailDraftPanel({ consultationId: _id }: { consultationId: string }) {
  return (
    <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">
      Evidence email panel — pending Agent 4
    </div>
  );
}

// Expected: <AuditTrail consultationId={string} />
// TODO: replace stub with import from components/audit/audit-trail.tsx when Agent 4 branch merges
function AuditTrail({ consultationId: _id }: { consultationId: string }) {
  return (
    <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">
      Audit trail — pending Agent 4
    </div>
  );
}

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

      {/* Transcript */}
      <section className="space-y-3">
        <SectionHeading>Transcript</SectionHeading>
        <TranscriptEditor
          consultationId={id}
          initialValue={consultation.transcript_raw}
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

import { redirect } from "next/navigation";

export default async function ConsultationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/meetings/${id}`);
}

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

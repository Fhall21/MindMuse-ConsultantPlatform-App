"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConsultations } from "@/hooks/use-consultations";
import { useExtractResearchInsight } from "@/hooks/use-research-extraction";
import type { LiteratureReference } from "@/hooks/use-research";

export interface ResearchExtractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  researchSessionId: string;
  quote: string;
  references?: LiteratureReference[];
  /** Optional pre-selected reference (when quote sits next to a citation chip). */
  initialReferenceId?: string | null;
  /**
   * Optional consultation to pre-select. If absent, the user picks from their
   * consultations in the dialog.
   */
  initialConsultationId?: string | null;
  onSuccess?: (insightId: string) => void;
}

function RequiredMark() {
  return (
    <span
      aria-hidden
      className="text-destructive"
      title="Required"
    >
      *
    </span>
  );
}

function deriveDefaultLabel(quote: string): string {
  // First sentence or first 80 chars — readable on a node card.
  const firstStop = quote.search(/[.!?]\s|$/);
  const candidate = firstStop > 0 && firstStop < 120 ? quote.slice(0, firstStop) : quote;
  return candidate.trim().slice(0, 120);
}

export function ResearchExtractionDialog({
  open,
  onOpenChange,
  researchSessionId,
  quote,
  references = [],
  initialReferenceId = null,
  initialConsultationId = null,
  onSuccess,
}: ResearchExtractionDialogProps) {
  const consultations = useConsultations();
  const extract = useExtractResearchInsight();

  const [label, setLabel] = useState(() => deriveDefaultLabel(quote));
  const [description, setDescription] = useState("");
  const [consultationId, setConsultationId] = useState<string | null>(initialConsultationId);
  const [referenceId, setReferenceId] = useState<string | null>(initialReferenceId);

  // Reset internal state whenever the dialog opens for a different quote.
  useEffect(() => {
    if (open) {
      setLabel(deriveDefaultLabel(quote));
      setDescription("");
      setConsultationId(initialConsultationId);
      setReferenceId(initialReferenceId);
    }
  }, [open, quote, initialConsultationId, initialReferenceId]);

  const consultationOptions = useMemo(
    () => consultations.data ?? [],
    [consultations.data]
  );

  const trimmedLabel = label.trim();
  const trimmedDescription = description.trim();
  const labelValid = trimmedLabel.length > 0;
  const descriptionValid = trimmedDescription.length >= 5;
  const consultationValid = Boolean(consultationId);
  const quoteValid = quote.trim().length >= 8;

  const canSubmit =
    labelValid &&
    descriptionValid &&
    consultationValid &&
    quoteValid &&
    !extract.isPending;

  const handleSubmit = async () => {
    if (!consultationId || !descriptionValid) return;

    const locator: Record<string, unknown> = {};
    if (referenceId) locator.referenceId = referenceId;

    try {
      const result = await extract.mutateAsync({
        consultationId,
        researchSessionId,
        quote,
        locator,
        label: trimmedLabel,
        description: trimmedDescription,
      });
      toast.success("Research insight added to canvas");
      onOpenChange(false);
      onSuccess?.(result.insight.id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add research insight"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 overflow-hidden sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Add as research insight</DialogTitle>
          <DialogDescription>
            Lift this passage onto a consultation canvas as a research-sourced insight.
            The full quote and reference are kept for the audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 flex-1 space-y-4 overflow-y-auto px-1 py-2">
          <p className="text-[11px] text-muted-foreground">
            Fields marked <RequiredMark /> are required.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Quoted passage <RequiredMark />
            </label>
            <blockquote className="max-h-[220px] overflow-y-auto whitespace-pre-wrap break-words rounded-md border-l-4 border-stone-300 bg-stone-50 px-3 py-2 text-sm leading-relaxed text-foreground dark:border-stone-700 dark:bg-stone-900/40">
              {quote}
            </blockquote>
          </div>

          <div className="space-y-1.5">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="research-insight-label"
            >
              Insight label <RequiredMark />
            </label>
            <Input
              id="research-insight-label"
              value={label}
              maxLength={500}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Short label shown on the canvas card"
              aria-invalid={!labelValid}
              required
            />
            {!labelValid ? (
              <p className="text-[11px] text-destructive">A label is required.</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="research-insight-description"
            >
              Notes <RequiredMark />
            </label>
            <Textarea
              id="research-insight-description"
              value={description}
              maxLength={4000}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why does this passage matter? How does it connect to consultation insights?"
              className="min-h-[72px]"
              aria-invalid={!descriptionValid}
              required
            />
            {!descriptionValid ? (
              <p className="text-[11px] text-destructive">
                Notes are required (at least 5 characters) so the audit trail
                records why this passage was lifted.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Consultation <RequiredMark />
            </label>
            <Select
              value={consultationId ?? undefined}
              onValueChange={(value) => setConsultationId(value)}
              disabled={consultations.isLoading || consultationOptions.length === 0}
            >
              <SelectTrigger aria-invalid={!consultationValid}>
                <SelectValue
                  placeholder={
                    consultations.isLoading
                      ? "Loading consultations…"
                      : consultationOptions.length === 0
                      ? "No consultations available"
                      : "Choose a consultation"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {consultationOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!consultationValid ? (
              <p className="text-[11px] text-destructive">
                Pick which consultation&rsquo;s canvas this insight belongs on.
              </p>
            ) : null}
          </div>

          {references.length > 0 ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Source reference{" "}
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  optional
                </span>
              </label>
              <Select
                value={referenceId ?? undefined}
                onValueChange={(value) => setReferenceId(value === "__none" ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Anchor to a specific reference" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No specific reference</SelectItem>
                  {references.map((ref) => (
                    <SelectItem key={`${ref.number}-${ref.title}`} value={String(ref.number)}>
                      [{ref.number}] {ref.title?.slice(0, 80) ?? "Untitled"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={extract.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {extract.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding…
              </>
            ) : (
              "Add to canvas"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

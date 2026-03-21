"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { addRoundCrossInsight } from "@/lib/actions/round-cross-insights";
import type { RoundConsultationSummary } from "@/types/round-detail";

interface LinkedConsultationsSectionProps {
  consultations: RoundConsultationSummary[];
}

function statusBadgeVariant(status: string) {
  if (status === "complete") return "default" as const;
  return "secondary" as const;
}

function emailStatusLabel(status: string | null) {
  if (!status) return null;
  if (status === "sent") return "Email sent";
  if (status === "accepted") return "Email ready";
  if (status === "draft") return "Email draft";
  return null;
}

interface InsightFormState {
  label: string;
  description: string;
}

interface AddedInsight {
  consultationId: string;
  label: string;
}

export function LinkedConsultationsSection({
  consultations,
}: LinkedConsultationsSectionProps) {
  const params = useParams();
  const roundId = Array.isArray(params.id) ? params.id[0] : (params.id ?? "");
  const [openFormFor, setOpenFormFor] = useState<string | null>(null);
  const [formState, setFormState] = useState<InsightFormState>({ label: "", description: "" });
  const [addedInsights, setAddedInsights] = useState<AddedInsight[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleOpenForm(consultationId: string) {
    setOpenFormFor(consultationId);
    setFormState({ label: "", description: "" });
  }

  function handleCloseForm() {
    setOpenFormFor(null);
    setFormState({ label: "", description: "" });
  }

  function handleSubmit(consultationId: string) {
    const label = formState.label.trim();
    if (!label) return;

    startTransition(async () => {
      try {
        await addRoundCrossInsight(roundId, consultationId, label, formState.description.trim() || undefined);
        setAddedInsights((prev) => [...prev, { consultationId, label }]);
        handleCloseForm();
        toast.success("Insight added", { description: label });
      } catch {
        toast.error("Failed to add insight");
      }
    });
  }

  if (consultations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Linked Consultations</CardTitle>
          <CardDescription>
            No consultations assigned to this round yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Linked Consultations</CardTitle>
        <CardDescription>
          {consultations.length} consultation{consultations.length !== 1 ? "s" : ""} in this round
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {consultations.map((c) => {
          const emailLabel = emailStatusLabel(c.evidenceEmailStatus);
          const consultationInsights = addedInsights.filter(
            (i) => i.consultationId === c.id
          );

          return (
            <div key={c.id} className="rounded-md border">
              {/* Row */}
              <div className="flex items-center justify-between px-3 py-2.5 gap-2">
                {/* Left: name pill + meta */}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/consultations/${c.id}`}
                      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground"
                    >
                      {c.title}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {c.themeCount} theme{c.themeCount !== 1 ? "s" : ""}
                    </span>
                    {emailLabel ? (
                      <span className="text-xs text-muted-foreground">
                        &middot; {emailLabel}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Right: status badge + Add as Insight */}
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={statusBadgeVariant(c.status)}>{c.status}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2"
                    onClick={() =>
                      openFormFor === c.id ? handleCloseForm() : handleOpenForm(c.id)
                    }
                  >
                    {openFormFor === c.id ? "Cancel" : "Add as Insight"}
                  </Button>
                </div>
              </div>

              {/* Inline insight form */}
              {openFormFor === c.id && (
                <div className="border-t px-3 py-3 space-y-3 bg-muted/30">
                  <div className="space-y-1">
                    <Label htmlFor={`insight-label-${c.id}`} className="text-xs">
                      Insight label <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`insight-label-${c.id}`}
                      placeholder="e.g. Workload pressure repeated across sites"
                      value={formState.label}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, label: e.target.value }))
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`insight-desc-${c.id}`} className="text-xs">
                      Description (optional)
                    </Label>
                    <Textarea
                      id={`insight-desc-${c.id}`}
                      placeholder="Provide context or evidence notes…"
                      value={formState.description}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, description: e.target.value }))
                      }
                      className="text-sm min-h-16 resize-none"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7"
                      onClick={handleCloseForm}
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => handleSubmit(c.id)}
                      disabled={isPending || !formState.label.trim()}
                    >
                      {isPending ? "Saving…" : "Save insight"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Newly added insights for this consultation */}
              {consultationInsights.length > 0 && (
                <div className="border-t px-3 py-2 space-y-1 bg-muted/10">
                  {consultationInsights.map((insight, idx) => (
                    <p key={idx} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      {insight.label}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

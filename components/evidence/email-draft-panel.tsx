"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useConsultation } from "@/hooks/use-consultations";
import { useEvidenceEmails } from "@/hooks/use-evidence-email";
import { useConsultationPeople } from "@/hooks/use-people";
import {
  acceptEmailDraft,
  markEmailSent,
  saveEmailDraft,
} from "@/lib/actions/evidence-emails";
import {
  getConsultationReportData,
  type IncludedThemeSelection,
} from "@/lib/actions/reports";
import type { EvidenceEmail } from "@/types/db";
import { ConsultationReportPanel } from "@/components/reports/consultation-report-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

interface EmailDraftPanelProps {
  consultationId: string;
}

interface EmailDraftResponse {
  subject?: string;
  body?: string;
  body_draft?: string;
}

function LoadingSpinner() {
  return (
    <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error) {
    return error;
  }

  return "Something went wrong. Please try again.";
}

function formatConsultationDate(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString().slice(0, 10);
}

function formatAbsoluteDate(value?: string | null) {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function readError(response: Response) {
  const text = await response.text();
  return text || `Request failed with status ${response.status}`;
}

async function generateEmailDraft(payload: {
  transcript: string;
  themes: string[];
  people: string[];
  consultation_title?: string;
  consultation_date?: string;
}) {
  const response = await fetch("/api/draft/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as EmailDraftResponse;
}

function getDraftStatusPresentation(status: EvidenceEmail["status"]) {
  if (status === "accepted") {
    return {
      label: "Accepted",
      className:
        "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200",
    };
  }

  if (status === "sent") {
    return {
      label: "Sent",
      className:
        "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/50 dark:text-sky-200",
    };
  }

  return {
    label: "Draft",
    className: "",
  };
}

function buildFallbackIncludedThemes(params: {
  consultationId: string;
  consultationTitle?: string | null;
  roundId?: string | null;
  roundLabel?: string | null;
  labels: string[];
}): IncludedThemeSelection[] {
  const { consultationId, consultationTitle, roundId, roundLabel, labels } = params;
  const seen = new Set<string>();

  return labels
    .filter((label) => {
      const key = label.trim().toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .map((label) => ({
      label,
      sourceKinds: ["consultation" as const],
      provenance: [
        {
          consultationId,
          consultationTitle: consultationTitle ?? null,
          roundId: roundId ?? null,
          roundLabel: roundLabel ?? null,
          isUserAdded: false,
        },
      ],
    }));
}

export function EmailDraftPanel({ consultationId }: EmailDraftPanelProps) {
  const queryClient = useQueryClient();
  const consultationQuery = useConsultation(consultationId);
  const evidenceEmailsQuery = useEvidenceEmails(consultationId);
  const peopleQuery = useConsultationPeople(consultationId);
  const reportQuery = useQuery({
    queryKey: ["consultation-report", consultationId],
    queryFn: async () => getConsultationReportData(consultationId),
    enabled: !!consultationId,
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [confirmAcceptOpen, setConfirmAcceptOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const acceptedThemeLabels = useMemo(
    () =>
      (consultationQuery.data?.themes ?? [])
        .filter((theme) => theme.accepted)
        .map((theme) => theme.label),
    [consultationQuery.data?.themes]
  );

  const includedThemes = useMemo<IncludedThemeSelection[]>(
    () =>
      reportQuery.data?.includedThemes ??
      buildFallbackIncludedThemes({
        consultationId,
        consultationTitle: consultationQuery.data?.consultation.title,
        roundId: consultationQuery.data?.consultation.round_id,
        roundLabel: reportQuery.data?.roundLabel ?? null,
        labels: acceptedThemeLabels,
      }),
    [
      acceptedThemeLabels,
      consultationId,
      consultationQuery.data?.consultation.round_id,
      consultationQuery.data?.consultation.title,
      reportQuery.data?.includedThemes,
      reportQuery.data?.roundLabel,
    ]
  );

  const includedThemeLabels = useMemo(
    () => includedThemes.map((theme) => theme.label),
    [includedThemes]
  );

  const drafts = evidenceEmailsQuery.data ?? [];
  const currentDraft = drafts[0] ?? null;
  const previousDrafts = drafts.slice(1);
  const currentDraftStatus = currentDraft?.status ?? "draft";
  const currentDraftPresentation = getDraftStatusPresentation(currentDraftStatus);
  const currentDraftSubject = currentDraft?.subject ?? "";
  const currentDraftBody = currentDraft?.body_draft ?? "";
  const isReadOnly =
    currentDraft?.status === "accepted" || currentDraft?.status === "sent";
  const isDirty =
    currentDraft !== null &&
    (subject !== currentDraftSubject || body !== currentDraftBody);

  useEffect(() => {
    setErrorMessage(null);
    setShowHistory(false);
    setConfirmAcceptOpen(false);
  }, [consultationId]);

  useEffect(() => {
    setSubject(currentDraftSubject);
    setBody(currentDraftBody);
  }, [currentDraftBody, currentDraftSubject, currentDraft?.id]);

  async function refreshPanelData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["consultations", consultationId] }),
      queryClient.invalidateQueries({ queryKey: ["evidence_emails", consultationId] }),
      queryClient.invalidateQueries({ queryKey: ["audit_log", consultationId] }),
      queryClient.invalidateQueries({
        queryKey: ["consultation-report", consultationId],
      }),
    ]);
  }

  async function handleGenerateDraft() {
    const transcript = consultationQuery.data?.consultation.transcript_raw?.trim() ?? "";

    if (!transcript || includedThemeLabels.length === 0) {
      return;
    }

    setErrorMessage(null);
    setIsGenerating(true);

    try {
      const generatedDraft = await generateEmailDraft({
        transcript,
        themes: includedThemeLabels,
        people: (peopleQuery.data ?? []).map((person) => person.name),
        consultation_title: consultationQuery.data?.consultation.title,
        consultation_date: formatConsultationDate(
          consultationQuery.data?.consultation.created_at
        ),
      });

      const nextSubject =
        generatedDraft.subject?.trim() || "Consultation follow-up evidence";
      const nextBody =
        generatedDraft.body?.trim() || generatedDraft.body_draft?.trim() || "";

      if (!nextBody) {
        throw new Error("The AI service returned an empty evidence email draft.");
      }

      await saveEmailDraft({
        consultationId,
        subject: nextSubject,
        body: nextBody,
        themeSelections: includedThemes,
      });

      await refreshPanelData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveEdits() {
    if (!currentDraft || !isDirty) {
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      await saveEmailDraft({
        consultationId,
        subject,
        body,
        themeSelections: includedThemes,
      });
      await refreshPanelData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAcceptDraft() {
    if (!currentDraft) {
      return;
    }

    setErrorMessage(null);
    setIsAccepting(true);

    try {
      const draftIdToAccept = isDirty
        ? await saveEmailDraft({
            consultationId,
            subject,
            body,
            themeSelections: includedThemes,
          })
        : currentDraft.id;

      await acceptEmailDraft(draftIdToAccept, consultationId);
      setConfirmAcceptOpen(false);
      await refreshPanelData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsAccepting(false);
    }
  }

  async function handleMarkSent() {
    if (!currentDraft) {
      return;
    }

    setErrorMessage(null);
    setIsSending(true);

    try {
      await markEmailSent(currentDraft.id, consultationId);
      await refreshPanelData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <Card className="border-border/70">
        <CardHeader>
          <div>
            <CardTitle>Evidence Email</CardTitle>
            <CardDescription>
              Generate a draft, refine it locally, and mark the official record
              as accepted or sent.
            </CardDescription>
          </div>
          {currentDraft ? (
            <CardAction>
              <Badge
                variant={currentDraft.status === "draft" ? "secondary" : "outline"}
                className={currentDraftPresentation.className}
              >
                {currentDraftPresentation.label}
              </Badge>
            </CardAction>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-4">
          {consultationQuery.isPending ||
          evidenceEmailsQuery.isPending ||
          peopleQuery.isPending ? (
            <p className="text-sm text-muted-foreground">
              Loading evidence email data…
            </p>
          ) : null}

          {consultationQuery.error ||
          evidenceEmailsQuery.error ||
          peopleQuery.error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {getErrorMessage(
                consultationQuery.error ??
                  evidenceEmailsQuery.error ??
                  peopleQuery.error
              )}
            </p>
          ) : null}

          {reportQuery.data ? (
            <ConsultationReportPanel report={reportQuery.data} />
          ) : null}

          {!consultationQuery.isPending &&
          !evidenceEmailsQuery.isPending &&
          currentDraft === null ? (
            <div className="space-y-3 rounded-lg border border-dashed border-border/80 bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                No evidence email generated yet.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={
                    isGenerating ||
                    includedThemeLabels.length === 0 ||
                    !(consultationQuery.data?.consultation.transcript_raw?.trim())
                  }
                  onClick={() => void handleGenerateDraft()}
                >
                  {isGenerating ? (
                    <>
                      <LoadingSpinner />
                      Generating…
                    </>
                  ) : (
                    "Generate draft"
                  )}
                </Button>
                {includedThemeLabels.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Accept at least one consultation or round theme before
                    generating the evidence email.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {currentDraft ? (
            <div className="space-y-4">
              {currentDraft.status === "draft" ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void handleGenerateDraft()}
                    disabled={
                      isGenerating ||
                      includedThemeLabels.length === 0 ||
                      !(consultationQuery.data?.consultation.transcript_raw?.trim())
                    }
                  >
                    {isGenerating ? (
                      <>
                        <LoadingSpinner />
                        Generating…
                      </>
                    ) : (
                      "Generate new draft"
                    )}
                  </Button>
                </div>
              ) : null}

              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor={`email-subject-${consultationId}`}
                >
                  Subject
                </label>
                <Input
                  id={`email-subject-${consultationId}`}
                  value={subject}
                  readOnly={isReadOnly}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor={`email-body-${consultationId}`}
                >
                  Draft body
                </label>
                <Textarea
                  id={`email-body-${consultationId}`}
                  className="min-h-[200px]"
                  value={body}
                  readOnly={isReadOnly}
                  onChange={(event) => setBody(event.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isDirty && !isReadOnly ? (
                  <Button onClick={() => void handleSaveEdits()} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <LoadingSpinner />
                        Saving…
                      </>
                    ) : (
                      "Save edits"
                    )}
                  </Button>
                ) : null}

                {currentDraft.status === "draft" ? (
                  <Button
                    variant="outline"
                    onClick={() => setConfirmAcceptOpen(true)}
                    disabled={isAccepting || isSaving}
                  >
                    Accept this draft
                  </Button>
                ) : null}

                {currentDraft.status === "accepted" ? (
                  <Button
                    variant="outline"
                    onClick={() => void handleMarkSent()}
                    disabled={isSending}
                  >
                    {isSending ? (
                      <>
                        <LoadingSpinner />
                        Marking…
                      </>
                    ) : (
                      "Mark as sent"
                    )}
                  </Button>
                ) : null}
              </div>

              {previousDrafts.length > 0 ? (
                <div className="rounded-lg border border-border/70 bg-muted/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium">
                      Previous drafts ({previousDrafts.length})
                    </p>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => setShowHistory((current) => !current)}
                    >
                      {showHistory ? "Hide" : "Show"}
                    </Button>
                  </div>

                  {showHistory ? (
                    <div className="mt-3 space-y-3">
                      {previousDrafts.map((draft) => (
                        <div
                          key={draft.id}
                          className="rounded-md border border-border/70 bg-background p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium">
                              {draft.subject || "Untitled draft"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatAbsoluteDate(
                                draft.generated_at ?? draft.created_at
                              )}
                            </p>
                          </div>
                          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                            {(draft.body_draft || "").slice(0, 240) ||
                              "No body preview available."}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {errorMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={confirmAcceptOpen} onOpenChange={setConfirmAcceptOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Accept this draft?</DialogTitle>
            <DialogDescription>
              {isDirty
                ? "Your unsaved edits will be saved as a new version and then marked as the official record."
                : "Mark this draft as accepted? This locks the draft as the official record."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAcceptOpen(false)}>
              Cancel
            </Button>
            <Button disabled={isAccepting} onClick={() => void handleAcceptDraft()}>
              {isAccepting ? (
                <>
                  <LoadingSpinner />
                  {isDirty ? "Saving and accepting…" : "Accepting…"}
                </>
              ) : isDirty ? (
                "Save and accept draft"
              ) : (
                "Accept draft"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

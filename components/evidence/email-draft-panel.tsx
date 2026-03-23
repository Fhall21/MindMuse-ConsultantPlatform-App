"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import posthog from "posthog-js";

import { useMeeting } from "@/hooks/use-meetings";
import { useMeetingEvidenceEmails } from "@/hooks/use-evidence-email";
import { useMeetingPeople } from "@/hooks/use-people";
import {
  acceptEmailDraft,
  markEmailSent,
  saveEmailDraft,
} from "@/lib/actions/evidence-emails";
import {
  getMeetingReportData,
  type IncludedThemeSelection,
} from "@/lib/actions/reports";
import type { EvidenceEmail } from "@/types/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  meetingId?: string;
  consultationId?: string;
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

export function EmailDraftPanel({ meetingId, consultationId }: EmailDraftPanelProps) {
  const resolvedMeetingId = meetingId ?? consultationId;
  const queryClient = useQueryClient();
  const meetingQuery = useMeeting(resolvedMeetingId ?? "");
  const evidenceEmailsQuery = useMeetingEvidenceEmails(resolvedMeetingId ?? "");
  const peopleQuery = useMeetingPeople(resolvedMeetingId ?? "");
  const reportQuery = useQuery({
    queryKey: ["meeting-report", resolvedMeetingId],
    queryFn: async () => getMeetingReportData(resolvedMeetingId ?? ""),
    enabled: !!resolvedMeetingId,
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [confirmAcceptOpen, setConfirmAcceptOpen] = useState(false);
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const acceptedThemeLabels = useMemo(
    () =>
      (meetingQuery.data?.themes ?? [])
        .filter((theme) => theme.accepted)
        .map((theme) => theme.label),
    [meetingQuery.data?.themes]
  );

  const includedThemes = useMemo<IncludedThemeSelection[]>(() => {
    const fromReport = reportQuery.data?.includedThemes;
    if (fromReport && fromReport.length > 0) return fromReport;
    return buildFallbackIncludedThemes({
      consultationId: resolvedMeetingId!,
      consultationTitle: meetingQuery.data?.meeting.title,
      roundId: meetingQuery.data?.meeting.consultation_id,
      roundLabel: reportQuery.data?.roundLabel ?? null,
      labels: acceptedThemeLabels,
    });
  }, [
    acceptedThemeLabels,
    meetingQuery.data?.meeting.consultation_id,
    meetingQuery.data?.meeting.title,
    reportQuery.data?.includedThemes,
    reportQuery.data?.roundLabel,
    resolvedMeetingId,
  ]);

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

  const themesChangedSinceEmail = useMemo(() => {
    if (!currentDraft || currentDraft.status !== "draft" || !currentDraft.generated_at) return false;
    const generatedAt = new Date(currentDraft.generated_at).getTime();
    return (meetingQuery.data?.themes ?? []).some(
      (theme) => theme.accepted && new Date(theme.created_at).getTime() > generatedAt
    );
  }, [currentDraft, meetingQuery.data?.themes]);

  useEffect(() => {
    setErrorMessage(null);
    setShowHistory(false);
    setConfirmAcceptOpen(false);
    setConfirmRegenerateOpen(false);
  }, [resolvedMeetingId]);

  useEffect(() => {
    setSubject(currentDraftSubject);
    setBody(currentDraftBody);
  }, [currentDraftBody, currentDraftSubject, currentDraft?.id]);

  async function refreshPanelData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["meetings", resolvedMeetingId] }),
      queryClient.invalidateQueries({ queryKey: ["evidence_emails", "meeting", resolvedMeetingId] }),
      queryClient.invalidateQueries({ queryKey: ["audit_log", "meeting", resolvedMeetingId] }),
      queryClient.invalidateQueries({
        queryKey: ["meeting-report", resolvedMeetingId],
      }),
    ]);
  }

  async function handleGenerateDraft() {
    const transcript = meetingQuery.data?.meeting.transcript_raw?.trim() ?? "";

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
        consultation_title: meetingQuery.data?.meeting.title,
        consultation_date: formatConsultationDate(
          meetingQuery.data?.meeting.created_at
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
        meetingId: resolvedMeetingId!,
        subject: nextSubject,
        body: nextBody,
        themeSelections: includedThemes,
      });

      posthog.capture("evidence_email_generated", {
        theme_count: includedThemeLabels.length,
        person_count: (peopleQuery.data ?? []).length,
      });

      await refreshPanelData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      posthog.captureException(error instanceof Error ? error : new Error("Evidence email generation failed"));
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
        meetingId: resolvedMeetingId!,
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
            meetingId: resolvedMeetingId!,
            subject,
            body,
            themeSelections: includedThemes,
          })
        : currentDraft.id;

      await acceptEmailDraft(draftIdToAccept, resolvedMeetingId!);
      posthog.capture("evidence_email_accepted", { saved_edits_first: isDirty });
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
      await markEmailSent(currentDraft.id, resolvedMeetingId!);
      posthog.capture("evidence_email_marked_sent");
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
        <CardContent className="space-y-4">
          {currentDraft ? (
            <div className="flex justify-end">
              <Badge
                variant={currentDraft.status === "draft" ? "secondary" : "outline"}
                className={currentDraftPresentation.className}
              >
                {currentDraftPresentation.label}
              </Badge>
            </div>
          ) : null}
          {meetingQuery.isPending ||
          evidenceEmailsQuery.isPending ||
          peopleQuery.isPending ? (
            <p className="text-sm text-muted-foreground">
              Loading evidence email data…
            </p>
          ) : null}

          {meetingQuery.error ||
          evidenceEmailsQuery.error ||
          peopleQuery.error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {getErrorMessage(
                meetingQuery.error ??
                  evidenceEmailsQuery.error ??
                  peopleQuery.error
              )}
            </p>
          ) : null}

          {!meetingQuery.isPending &&
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
                    !(meetingQuery.data?.meeting.transcript_raw?.trim())
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {themesChangedSinceEmail ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Themes have changed since this draft was generated — consider regenerating.
                    </p>
                  ) : <span />}
                  <Button
                    variant={themesChangedSinceEmail ? "default" : "outline"}
                    onClick={() => setConfirmRegenerateOpen(true)}
                    disabled={
                      isGenerating ||
                      includedThemeLabels.length === 0 ||
                      !(meetingQuery.data?.meeting.transcript_raw?.trim())
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
                  htmlFor={`email-subject-${resolvedMeetingId}`}
                >
                  Subject
                </label>
                <Input
                  id={`email-subject-${resolvedMeetingId}`}
                  value={subject}
                  readOnly={isReadOnly}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor={`email-body-${resolvedMeetingId}`}
                >
                  Draft body
                </label>
                <Textarea
                  id={`email-body-${resolvedMeetingId}`}
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
                          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                            {draft.body_draft || "No body available."}
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

      <Dialog open={confirmRegenerateOpen} onOpenChange={setConfirmRegenerateOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Generate a new draft?</DialogTitle>
            <DialogDescription>
              Any manual edits you&apos;ve made to the current draft will not carry over to the new generation. The previous draft will be preserved in history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRegenerateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={isGenerating}
              onClick={() => {
                setConfirmRegenerateOpen(false);
                void handleGenerateDraft();
              }}
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

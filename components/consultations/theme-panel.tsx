"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useConsultation } from "@/hooks/use-consultations";
import { useThemes } from "@/hooks/use-themes";
import { acceptTheme, rejectTheme, saveThemes } from "@/lib/actions/themes";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Theme } from "@/types/db";
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

const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL ?? "http://localhost:8000";

interface ThemePanelProps {
  consultationId: string;
}

interface ExtractedTheme {
  label: string;
  description?: string;
  confidence?: number;
}

interface ThemeDetails {
  description?: string;
  confidence?: number;
}

interface RejectedThemeSnapshot extends Theme {
  description?: string;
  confidence?: number;
}

function LoadingSpinner() {
  return <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />;
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

async function readError(response: Response) {
  const text = await response.text();
  return text || `Request failed with status ${response.status}`;
}

async function extractThemes(transcript: string) {
  const response = await fetch(`${AI_SERVICE_URL}/themes/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transcript }),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const payload = (await response.json()) as { themes?: ExtractedTheme[] };
  return payload.themes ?? [];
}

async function getClarificationQuestions(payload: { transcript: string; themes: string[] }) {
  const response = await fetch(`${AI_SERVICE_URL}/clarification/questions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const body = (await response.json()) as { questions?: string[] } | string[];
  if (Array.isArray(body)) {
    return body;
  }

  return Array.isArray(body.questions) ? body.questions : [];
}

function getConfidenceLabel(confidence?: number) {
  if (confidence === undefined || Number.isNaN(confidence)) {
    return { label: "Pending review", className: "text-muted-foreground" };
  }

  if (confidence >= 0.7) {
    return {
      label: "High confidence",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    };
  }

  if (confidence >= 0.4) {
    return {
      label: "Medium confidence",
      className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
    };
  }

  return {
    label: "Low confidence",
    className: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
  };
}

export function ThemePanel({ consultationId }: ThemePanelProps) {
  const queryClient = useQueryClient();
  const consultationQuery = useConsultation(consultationId);
  const themesQuery = useThemes(consultationId);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isClarifying, setIsClarifying] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [confirmReextractOpen, setConfirmReextractOpen] = useState(false);
  const [clarificationOpen, setClarificationOpen] = useState(false);
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([]);
  const [themeDetailsById, setThemeDetailsById] = useState<Record<string, ThemeDetails>>({});
  // TODO: from Agent 1 - persist rejected themes and extracted metadata in DB/actions so this survives refresh.
  const [rejectedThemes, setRejectedThemes] = useState<Record<string, RejectedThemeSnapshot>>({});

  useEffect(() => {
    setErrorMessage(null);
    setConfirmReextractOpen(false);
    setClarificationOpen(false);
    setClarificationQuestions([]);
    setThemeDetailsById({});
    setRejectedThemes({});
  }, [consultationId]);

  const transcript = consultationQuery.data?.consultation.transcript_raw?.trim() ?? "";
  const savedThemes = themesQuery.data ?? [];

  const rejectedThemeList = useMemo(
    () => Object.values(rejectedThemes).sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at)),
    [rejectedThemes]
  );

  const acceptedThemeLabels = useMemo(
    () =>
      savedThemes
        .filter((theme) => theme.accepted && !rejectedThemes[theme.id])
        .map((theme) => theme.label),
    [rejectedThemes, savedThemes]
  );

  const reviewedCount = acceptedThemeLabels.length + rejectedThemeList.length;
  const totalThemeCount = savedThemes.length + rejectedThemeList.length;
  const pendingCount = savedThemes.filter((theme) => !theme.accepted && !rejectedThemes[theme.id]).length;
  const allReviewed = totalThemeCount > 0 && pendingCount === 0;

  const displayThemes = useMemo(() => {
    const saved = savedThemes.map((theme) => ({
      theme,
      rejected: false,
      details: themeDetailsById[theme.id],
    }));
    const rejected = rejectedThemeList.map((theme) => ({
      theme,
      rejected: true,
      details: {
        description: theme.description,
        confidence: theme.confidence,
      },
    }));

    return [...saved, ...rejected].sort(
      (left, right) => Date.parse(right.theme.created_at) - Date.parse(left.theme.created_at)
    );
  }, [rejectedThemeList, savedThemes, themeDetailsById]);

  async function refreshPanelData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["consultations", consultationId] }),
      queryClient.invalidateQueries({ queryKey: ["themes", consultationId] }),
      queryClient.invalidateQueries({ queryKey: ["audit_log", consultationId] }),
    ]);
  }

  async function runExtraction(options?: { replaceExisting?: boolean }) {
    if (!transcript) {
      return;
    }

    setErrorMessage(null);
    setIsExtracting(true);

    try {
      const extractedThemes = await extractThemes(transcript);

      if (extractedThemes.length === 0) {
        throw new Error("The AI service did not return any themes.");
      }

      if (options?.replaceExisting) {
        const supabase = createClient();
        const { error } = await supabase.from("themes").delete().eq("consultation_id", consultationId);

        if (error) {
          throw error;
        }
      }

      const savedThemeIds = (await saveThemes(
        consultationId,
        extractedThemes.map((theme) => ({
          label: theme.label,
          confidence: theme.confidence,
        }))
      )) as Array<{ id: string }> | null;

      const nextDetails: Record<string, ThemeDetails> = {};
      savedThemeIds?.forEach((savedTheme, index) => {
        const extractedTheme = extractedThemes[index];
        if (savedTheme?.id && extractedTheme) {
          nextDetails[savedTheme.id] = {
            description: extractedTheme.description,
            confidence: extractedTheme.confidence,
          };
        }
      });

      setThemeDetailsById(nextDetails);
      setRejectedThemes({});
      setClarificationQuestions([]);
      setClarificationOpen(false);
      setConfirmReextractOpen(false);

      await refreshPanelData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleAccept(themeId: string) {
    setErrorMessage(null);
    setActiveThemeId(themeId);

    try {
      await acceptTheme(themeId, consultationId);
      await refreshPanelData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setActiveThemeId(null);
    }
  }

  async function handleReject(theme: Theme) {
    const details = themeDetailsById[theme.id];
    const snapshot: RejectedThemeSnapshot = {
      ...theme,
      description: details?.description,
      confidence: details?.confidence,
    };

    setErrorMessage(null);
    setActiveThemeId(theme.id);
    setRejectedThemes((current) => ({
      ...current,
      [theme.id]: snapshot,
    }));

    try {
      await rejectTheme(theme.id, consultationId);
      await refreshPanelData();
    } catch (error) {
      setRejectedThemes((current) => {
        const next = { ...current };
        delete next[theme.id];
        return next;
      });
      setErrorMessage(getErrorMessage(error));
    } finally {
      setActiveThemeId(null);
    }
  }

  async function handleClarificationRequest() {
    if (!transcript || acceptedThemeLabels.length === 0) {
      return;
    }

    setErrorMessage(null);
    setIsClarifying(true);

    try {
      const questions = await getClarificationQuestions({
        transcript,
        themes: acceptedThemeLabels,
      });
      setClarificationQuestions(questions);
      setClarificationOpen(true);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsClarifying(false);
    }
  }

  return (
    <>
      <Card className="border-border/70">
        <CardHeader>
          <div>
            <CardTitle>Theme Review</CardTitle>
            <CardDescription>Extract consultation themes, review them, and keep clarification prompts close at hand.</CardDescription>
          </div>
          {totalThemeCount > 0 ? (
            <CardAction>
              <Badge variant="secondary">{reviewedCount} reviewed</Badge>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {consultationQuery.isPending || themesQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Loading theme data…</p>
          ) : null}

          {consultationQuery.error || themesQuery.error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {getErrorMessage(consultationQuery.error ?? themesQuery.error)}
            </p>
          ) : null}

          {!consultationQuery.isPending && !themesQuery.isPending && totalThemeCount === 0 ? (
            <div className="space-y-3 rounded-lg border border-dashed border-border/80 bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">No themes extracted yet.</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button disabled={!transcript || isExtracting} onClick={() => void runExtraction()}>
                  {isExtracting ? (
                    <>
                      <LoadingSpinner />
                      Extracting…
                    </>
                  ) : (
                    "Extract themes"
                  )}
                </Button>
                {!transcript ? (
                  <p className="text-xs text-muted-foreground">Add a transcript before extracting themes.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {!consultationQuery.isPending && !themesQuery.isPending && totalThemeCount > 0 && !allReviewed ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {reviewedCount} of {totalThemeCount} themes reviewed
              </p>

              <div className="space-y-3">
                {displayThemes.map(({ theme, rejected, details }) => {
                  const confidence = getConfidenceLabel(details?.confidence);
                  const isAccepted = theme.accepted && !rejected;
                  const isBusy = activeThemeId === theme.id;

                  return (
                    <div
                      key={`${theme.id}-${rejected ? "rejected" : "current"}`}
                      className={cn(
                        "rounded-lg border p-4 transition-colors",
                        isAccepted && "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20",
                        rejected && "border-destructive/30 bg-destructive/5 opacity-75"
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className={cn("font-medium", rejected && "line-through")}>{theme.label}</p>
                          {details?.description ? (
                            <p className="text-sm text-muted-foreground">{details.description}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground">Awaiting persisted theme details from the shared schema.</p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {isAccepted ? (
                            <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200">
                              Accepted
                            </Badge>
                          ) : null}
                          {rejected ? <Badge variant="destructive">Rejected</Badge> : null}
                          {!isAccepted && !rejected ? (
                            <Badge variant="outline" className={confidence.className}>
                              {confidence.label}
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      {!rejected ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => void handleAccept(theme.id)}
                            disabled={isAccepted || isBusy}
                            className={cn(isAccepted && "bg-emerald-600 text-white hover:bg-emerald-600/90")}
                          >
                            {isBusy && !isAccepted ? <LoadingSpinner /> : null}
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => void handleReject(theme)}
                          >
                            {isBusy ? <LoadingSpinner /> : null}
                            Reject
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {!consultationQuery.isPending && !themesQuery.isPending && allReviewed ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{acceptedThemeLabels.length} themes accepted</p>
                  <p className="text-xs text-muted-foreground">Review is complete for this extraction round.</p>
                </div>
                <Button variant="outline" disabled={isExtracting} onClick={() => setConfirmReextractOpen(true)}>
                  {isExtracting ? (
                    <>
                      <LoadingSpinner />
                      Extracting…
                    </>
                  ) : (
                    "Re-extract"
                  )}
                </Button>
              </div>

              {acceptedThemeLabels.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {acceptedThemeLabels.map((label) => (
                    <Badge
                      key={label}
                      className="border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200"
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No themes were accepted in the current review.</p>
              )}
            </div>
          ) : null}

          {totalThemeCount > 0 ? (
            <div className="border-t border-border/70 pt-4">
              <Button
                variant="link"
                size="sm"
                className="h-auto px-0 text-sm"
                disabled={isClarifying || acceptedThemeLabels.length === 0}
                onClick={() => void handleClarificationRequest()}
              >
                {isClarifying ? (
                  <>
                    <LoadingSpinner />
                    Loading clarification questions…
                  </>
                ) : (
                  "Need clarification?"
                )}
              </Button>

              {acceptedThemeLabels.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">Accept at least one theme before requesting clarification questions.</p>
              ) : null}

              {clarificationOpen ? (
                <div className="mt-3 rounded-lg border border-border/70 bg-muted/10 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Suggested clarification questions</p>
                    <Button size="xs" variant="ghost" onClick={() => setClarificationOpen(false)}>
                      Hide
                    </Button>
                  </div>
                  {clarificationQuestions.length > 0 ? (
                    <ol className="space-y-2 text-sm text-muted-foreground">
                      {clarificationQuestions.map((question, index) => (
                        <li key={`${question}-${index}`}>{index + 1}. {question}</li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted-foreground">No clarification questions were returned.</p>
                  )}
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

      <Dialog open={confirmReextractOpen} onOpenChange={setConfirmReextractOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Replace current themes?</DialogTitle>
            <DialogDescription>This will replace current themes for this consultation with a new extraction.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReextractOpen(false)}>
              Cancel
            </Button>
            <Button disabled={isExtracting} onClick={() => void runExtraction({ replaceExisting: true })}>
              {isExtracting ? (
                <>
                  <LoadingSpinner />
                  Extracting…
                </>
              ) : (
                "Replace themes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

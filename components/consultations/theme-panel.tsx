"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useConsultation } from "@/hooks/use-consultations";
import { useThemes } from "@/hooks/use-themes";
import { acceptTheme, addUserTheme, rejectTheme, saveThemes } from "@/lib/actions/themes";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ThemeRejectionDialog } from "@/components/consultations/theme-rejection-dialog";


interface ThemePanelProps {
  consultationId: string;
}

interface ExtractedTheme {
  label: string;
  description?: string;
  confidence?: number;
}

interface ThemeDetails {
  description?: string | null;
  confidence?: number;
}

interface RejectedThemeSnapshot extends Theme {
  confidence?: number;
  rationale?: string;
}

interface ThemeDisplayItem {
  id: string;
  label: string;
  description: string | null;
  accepted: boolean;
  rejected: boolean;
  source: "ai" | "user";
  rejectionRationale?: string;
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
  const response = await fetch(`/api/themes/extract`, {
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
  const response = await fetch(`/api/clarification/questions`, {
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

function getThemeDescription(description?: string | null) {
  return description ?? "Awaiting persisted theme details from the shared schema.";
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

  // TODO: Agent 1 — persist rejected themes and rationale in DB/actions so this survives refresh.
  const [rejectedThemes, setRejectedThemes] = useState<Record<string, RejectedThemeSnapshot>>({});

  // Rejection dialog
  const [rejectionDialogTheme, setRejectionDialogTheme] = useState<Theme | null>(null);

  // Inline add-theme form
  const [addThemeOpen, setAddThemeOpen] = useState(false);
  const [addThemeLabel, setAddThemeLabel] = useState("");
  const [addThemeDescription, setAddThemeDescription] = useState("");
  const [addThemeError, setAddThemeError] = useState<string | null>(null);
  const [isAddingTheme, setIsAddingTheme] = useState(false);

  useEffect(() => {
    setErrorMessage(null);
    setConfirmReextractOpen(false);
    setClarificationOpen(false);
    setClarificationQuestions([]);
    setThemeDetailsById({});
    setRejectedThemes({});
    setAddThemeOpen(false);
    setAddThemeLabel("");
    setAddThemeDescription("");
    setRejectionDialogTheme(null);
  }, [consultationId]);

  const transcript = consultationQuery.data?.consultation.transcript_raw?.trim() ?? "";
  const consultationIsLocked = consultationQuery.data?.consultation.status === "complete";
  const savedThemes = useMemo(() => themesQuery.data ?? [], [themesQuery.data]);

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

  const acceptedThemeList = useMemo<ThemeDisplayItem[]>(
    () =>
      savedThemes
        .filter((theme) => theme.accepted && !rejectedThemes[theme.id])
        .map((theme) => ({
          id: theme.id,
          label: theme.label,
          description: themeDetailsById[theme.id]?.description ?? theme.description ?? null,
          accepted: true,
          rejected: false,
          source: theme.is_user_added ? ("user" as const) : ("ai" as const),
        })),
    [rejectedThemes, savedThemes, themeDetailsById]
  );

  const rejectedThemeDisplayList = useMemo<ThemeDisplayItem[]>(
    () =>
      rejectedThemeList.map((theme) => ({
        id: theme.id,
        label: theme.label,
        description: theme.description ?? null,
        accepted: false,
        rejected: true,
        source: theme.is_user_added ? ("user" as const) : ("ai" as const),
        rejectionRationale: theme.rationale,
      })),
    [rejectedThemeList]
  );

  const reviewedCount = acceptedThemeList.length + rejectedThemeList.length;
  const totalThemeCount = savedThemes.length + rejectedThemeList.length;
  const pendingCount = savedThemes.filter((theme) => !theme.accepted && !rejectedThemes[theme.id]).length;
  const allReviewed = totalThemeCount > 0 && pendingCount === 0;

  const displayThemes = useMemo(() => {
    const saved = savedThemes.map((theme) => ({
      theme,
      rejected: false,
      details: themeDetailsById[theme.id],
      source: theme.is_user_added ? ("user" as const) : ("ai" as const),
    }));
    const rejected = rejectedThemeList.map((theme) => ({
      theme,
      rejected: true,
      details: {
        description: theme.description,
        confidence: theme.confidence,
      },
      source: theme.is_user_added ? ("user" as const) : ("ai" as const),
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
          description: theme.description ?? null,
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

  function openRejectionDialog(theme: Theme) {
    setRejectionDialogTheme(theme);
  }

  async function handleRejectionConfirm(rationale: string) {
    const theme = rejectionDialogTheme;
    if (!theme) return;

    const details = themeDetailsById[theme.id];
    const snapshot: RejectedThemeSnapshot = {
      ...theme,
      description: details?.description ?? theme.description ?? null,
      confidence: details?.confidence,
      rationale,
    };

    setErrorMessage(null);
    setActiveThemeId(theme.id);
    setRejectedThemes((current) => ({ ...current, [theme.id]: snapshot }));
    setRejectionDialogTheme(null);

    try {
      await rejectTheme(theme.id, consultationId, rationale);
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

  function handleRejectionCancel() {
    setRejectionDialogTheme(null);
  }

  async function handleAddCustomTheme() {
    const label = addThemeLabel.trim();
    if (!label) {
      setAddThemeError("Theme label is required.");
      return;
    }

    setAddThemeError(null);
    setIsAddingTheme(true);

    try {
      // addUserTheme: sets is_user_added=true, accepted=true, weight=2.0, logs learning signal
      await addUserTheme(consultationId, label, addThemeDescription.trim() || undefined);

      setAddThemeLabel("");
      setAddThemeDescription("");
      setAddThemeOpen(false);
      await refreshPanelData();
    } catch (error) {
      setAddThemeError(getErrorMessage(error));
    } finally {
      setIsAddingTheme(false);
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

          {/* Empty state */}
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
                <Button
                  variant="outline"
                  onClick={() => setAddThemeOpen(true)}
                  disabled={isAddingTheme || addThemeOpen}
                >
                  Add theme
                </Button>
                {!transcript ? (
                  <p className="text-xs text-muted-foreground">Add a transcript before extracting themes.</p>
                ) : null}
              </div>
              {addThemeOpen ? (
                <AddThemeForm
                  label={addThemeLabel}
                  error={addThemeError}
                  isSubmitting={isAddingTheme}
                  onLabelChange={(v) => { setAddThemeLabel(v); if (addThemeError) setAddThemeError(null); }}
                  description={addThemeDescription}
                  onDescriptionChange={setAddThemeDescription}
                  onSubmit={() => void handleAddCustomTheme()}
                  onCancel={() => { setAddThemeOpen(false); setAddThemeLabel(""); setAddThemeDescription(""); setAddThemeError(null); }}
                />
              ) : null}
            </div>
          ) : null}

          {/* In-progress review */}
          {!consultationQuery.isPending && !themesQuery.isPending && totalThemeCount > 0 && !allReviewed ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {reviewedCount} of {totalThemeCount} themes reviewed
                </p>
                {!addThemeOpen ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAddThemeOpen(true)}
                    disabled={isAddingTheme}
                  >
                    Add theme
                  </Button>
                ) : null}
              </div>

              {addThemeOpen ? (
                <AddThemeForm
                  label={addThemeLabel}
                  error={addThemeError}
                  isSubmitting={isAddingTheme}
                  onLabelChange={(v) => { setAddThemeLabel(v); if (addThemeError) setAddThemeError(null); }}
                  description={addThemeDescription}
                  onDescriptionChange={setAddThemeDescription}
                  onSubmit={() => void handleAddCustomTheme()}
                  onCancel={() => { setAddThemeOpen(false); setAddThemeLabel(""); setAddThemeDescription(""); setAddThemeError(null); }}
                />
              ) : null}

              <div className="space-y-3">
                {displayThemes.map(({ theme, rejected, details, source }) => {
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
                          {(details?.description ?? theme.description) ? (
                            <p className="text-sm text-muted-foreground">{details?.description ?? theme.description}</p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Source badge */}
                          {source === "user" ? (
                            <Badge
                              variant="outline"
                              className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
                            >
                              User added
                            </Badge>
                          ) : (!isAccepted && !rejected) ? (
                            <Badge
                              variant="outline"
                              className="border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300"
                            >
                              AI suggested
                            </Badge>
                          ) : null}

                          {/* Decision badges */}
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

                      {/* Rejection rationale */}
                      {rejected && rejectedThemes[theme.id]?.rationale ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          <span className="font-medium">Rationale:</span>{" "}
                          {rejectedThemes[theme.id].rationale}
                        </p>
                      ) : null}

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
                            onClick={() => openRejectionDialog(theme)}
                          >
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

          {/* All reviewed */}
          {!consultationQuery.isPending && !themesQuery.isPending && allReviewed ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{acceptedThemeList.length} themes accepted</p>
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

              {acceptedThemeList.length > 0 ? (
                <div className="space-y-2">
                  {acceptedThemeList.map((theme) => (
                    <div
                      key={theme.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-medium">{theme.label}</p>
                        {theme.description ? (
                          <p className="text-sm text-muted-foreground">{theme.description}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {theme.source === "user" ? (
                          <Badge
                            variant="outline"
                            className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
                          >
                            User added
                          </Badge>
                        ) : null}
                        <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200">
                          Accepted
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No themes were accepted in the current review.</p>
              )}

              {rejectedThemeDisplayList.length > 0 ? (
                <div className="space-y-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground/85">Rejected themes</p>
                    <p className="text-xs text-muted-foreground">These stay visible in-session until the page is refreshed.</p>
                  </div>

                  <div className="space-y-2">
                    {rejectedThemeDisplayList.map((theme) => (
                      <div
                        key={theme.id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-destructive/20 bg-background/80 p-3 opacity-75"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="font-medium line-through">{theme.label}</p>
                          {theme.description ? (
                            <p className="text-sm text-muted-foreground">{theme.description}</p>
                          ) : null}
                          {theme.rejectionRationale ? (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">Rationale:</span> {theme.rejectionRationale}
                            </p>
                          ) : null}
                        </div>
                        <Badge variant="destructive">Rejected</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
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

      <ThemeRejectionDialog
        open={rejectionDialogTheme !== null}
        themeLabel={rejectionDialogTheme?.label ?? ""}
        requiresRationale={consultationIsLocked}
        onConfirm={handleRejectionConfirm}
        onCancel={handleRejectionCancel}
      />
    </>
  );
}

// ─── Inline add-theme form ────────────────────────────────────────────────────

interface AddThemeFormProps {
  label: string;
  description: string;
  error: string | null;
  isSubmitting: boolean;
  onLabelChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function AddThemeForm({
  label,
  description,
  error,
  isSubmitting,
  onLabelChange,
  onDescriptionChange,
  onSubmit,
  onCancel,
}: AddThemeFormProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === "Escape") {
      onCancel();
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border/80 bg-muted/10 p-3">
      <p className="text-xs font-medium text-muted-foreground">Add a custom theme</p>
      <Input
        autoFocus
        placeholder="Theme label…"
        value={label}
        onChange={(e) => onLabelChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isSubmitting}
        className="h-8 text-sm"
      />
      <Textarea
        placeholder="Brief description (optional)…"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        disabled={isSubmitting}
        className="min-h-[60px] text-sm"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onSubmit} disabled={isSubmitting || !label.trim()}>
          {isSubmitting ? <LoadingSpinner /> : null}
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

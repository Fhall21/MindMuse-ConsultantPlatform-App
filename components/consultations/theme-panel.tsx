"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { fetchJson } from "@/hooks/api";
import { useMeeting } from "@/hooks/use-meetings";
import { useMeetingThemes } from "@/hooks/use-themes";
import { acceptTheme, addUserTheme, rejectTheme, restoreTheme, saveThemes } from "@/lib/actions/themes";
import { cn } from "@/lib/utils";
import type { Insight } from "@/types/db";
import posthog from "posthog-js";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ThemeRejectionDialog } from "@/components/consultations/theme-rejection-dialog";


interface ThemePanelProps {
  meetingId?: string;
  consultationId?: string;
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

interface ThemeDisplayItem {
  id: string;
  label: string;
  description: string | null;
  accepted: boolean;
  rejected: boolean;
  source: "ai" | "user";
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

async function extractThemes(
  transcript: string,
  options?: { limit?: number; excludeLabels?: string[] }
) {
  const response = await fetch(`/api/themes/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transcript,
      ...(options?.limit !== undefined && { limit: options.limit }),
      ...(options?.excludeLabels && options.excludeLabels.length > 0 && {
        exclude_labels: options.excludeLabels,
      }),
    }),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const payload = (await response.json()) as { themes?: ExtractedTheme[] };
  let themes = payload.themes ?? [];

  // Client-side fallback: filter out labels already present and enforce limit
  if (options?.excludeLabels && options.excludeLabels.length > 0) {
    const excluded = new Set(options.excludeLabels.map((l) => l.toLowerCase()));
    themes = themes.filter((t) => !excluded.has(t.label.toLowerCase()));
  }
  if (options?.limit !== undefined) {
    themes = themes.slice(0, options.limit);
  }

  return themes;
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

  const body = (await response.json()) as { questions?: Array<{ question: string } | string> } | string[];
  const readQuestion = (value: { question: string } | string) =>
    typeof value === "string" ? value : value.question;

  if (Array.isArray(body)) {
    return body.map(readQuestion);
  }

  if (!Array.isArray(body.questions)) return [];
  return body.questions.map(readQuestion);
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

export function ThemePanel({ meetingId, consultationId }: ThemePanelProps) {
  const resolvedMeetingId = meetingId ?? consultationId;
  const queryClient = useQueryClient();
  const meetingQuery = useMeeting(resolvedMeetingId ?? "");
  const themesQuery = useMeetingThemes(resolvedMeetingId ?? "");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [isClarifying, setIsClarifying] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [restoringThemeId, setRestoringThemeId] = useState<string | null>(null);
  const [confirmReextractOpen, setConfirmReextractOpen] = useState(false);
  const [clarificationOpen, setClarificationOpen] = useState(false);
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([]);
  const [themeDetailsById, setThemeDetailsById] = useState<Record<string, ThemeDetails>>({});
  // IDs of themes currently animating out after rejection
  const [collapsingIds, setCollapsingIds] = useState<Set<string>>(new Set());

  // Rejection dialog
  const [rejectionDialogTheme, setRejectionDialogTheme] = useState<Insight | null>(null);

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
    setCollapsingIds(new Set());
    setAddThemeOpen(false);
    setAddThemeLabel("");
    setAddThemeDescription("");
    setRejectionDialogTheme(null);
  }, [resolvedMeetingId]);

  const transcript = meetingQuery.data?.meeting.transcript_raw?.trim() ?? "";
  const consultationIsLocked = meetingQuery.data?.meeting.status === "complete";
  const savedThemes = useMemo(() => themesQuery.data ?? [], [themesQuery.data]);

  // Derive lists from DB-backed data (rejected is a column now)
  const pendingThemes = useMemo(
    () => savedThemes.filter((t) => !t.accepted && !t.rejected),
    [savedThemes]
  );
  const acceptedThemes = useMemo(
    () => savedThemes.filter((t) => t.accepted && !t.rejected),
    [savedThemes]
  );
  const rejectedThemeList = useMemo(
    () => savedThemes.filter((t) => t.rejected),
    [savedThemes]
  );
  const activeThemes = useMemo(
    () => savedThemes.filter((t) => !t.rejected),
    [savedThemes]
  );

  const acceptedThemeLabels = useMemo(
    () => acceptedThemes.map((t) => t.label),
    [acceptedThemes]
  );

  const allActiveLabels = useMemo(
    () => activeThemes.map((t) => t.label),
    [activeThemes]
  );

  const totalCount = savedThemes.length;
  const allReviewed = activeThemes.length > 0 && pendingThemes.length === 0;

  async function refreshPanelData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["meetings", resolvedMeetingId] }),
      queryClient.invalidateQueries({ queryKey: ["themes", "meeting", resolvedMeetingId] }),
      queryClient.invalidateQueries({ queryKey: ["audit_log", "meeting", resolvedMeetingId] }),
    ]);
  }

  async function runExtraction(options?: { replaceExisting?: boolean; generateMore?: boolean }) {
    if (!transcript) {
      return;
    }

    setErrorMessage(null);

    if (options?.generateMore) {
      setIsGeneratingMore(true);
    } else {
      setIsExtracting(true);
    }

    try {
      const extractOptions = options?.generateMore
        ? { limit: 5, excludeLabels: allActiveLabels }
        : undefined;

      const extractedThemes = await extractThemes(transcript, extractOptions);

      if (extractedThemes.length === 0) {
        throw new Error("The AI service did not return any new themes.");
      }

      if (options?.replaceExisting) {
        await fetchJson<{ ok: true }>(
          `/api/client/themes/consultations/${resolvedMeetingId}`,
          { method: "DELETE" }
        );
      }

      const savedThemeIds = (await saveThemes(
        resolvedMeetingId!,
        extractedThemes.map((theme) => ({
          label: theme.label,
          confidence: theme.confidence,
          description: theme.description ?? null,
        }))
      )) as Array<{ id: string }> | null;

      const nextDetails: Record<string, ThemeDetails> = { ...themeDetailsById };
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
      if (!options?.generateMore) {
        setClarificationQuestions([]);
        setClarificationOpen(false);
        setConfirmReextractOpen(false);
      }

      posthog.capture("themes_extracted", {
        theme_count: extractedThemes.length,
        replace_existing: options?.replaceExisting ?? false,
        generate_more: options?.generateMore ?? false,
      });

      await refreshPanelData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      posthog.captureException(error instanceof Error ? error : new Error("Theme extraction failed"));
    } finally {
      setIsExtracting(false);
      setIsGeneratingMore(false);
    }
  }

  async function handleAccept(themeId: string) {
    setErrorMessage(null);
    setActiveThemeId(themeId);

    try {
      await acceptTheme(themeId, resolvedMeetingId!);
      posthog.capture("theme_accepted");
      await refreshPanelData();
    } catch (error) {
      console.error("[theme-panel] failed to accept insight", {
        themeId,
        meetingId: resolvedMeetingId,
        error,
      });
      setErrorMessage(getErrorMessage(error));
    } finally {
      setActiveThemeId(null);
    }
  }

  function openRejectionDialog(theme: Insight) {
    setRejectionDialogTheme(theme);
  }

  async function handleRejectionConfirm(rationale: string) {
    const theme = rejectionDialogTheme;
    if (!theme) return;

    setErrorMessage(null);
    setActiveThemeId(theme.id);
    setRejectionDialogTheme(null);

    // Start collapse animation
    setCollapsingIds((prev) => new Set([...prev, theme.id]));

    try {
      await rejectTheme(theme.id, resolvedMeetingId!, rationale);
      posthog.capture("theme_rejected", { has_rationale: Boolean(rationale) });
      // Brief delay so the animation has time to play before the DOM updates
      await new Promise((r) => setTimeout(r, 250));
      await refreshPanelData();
    } catch (error) {
      setCollapsingIds((prev) => {
        const next = new Set(prev);
        next.delete(theme.id);
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

  async function handleRestore(themeId: string) {
    setRestoringThemeId(themeId);
    setErrorMessage(null);

    try {
      await restoreTheme(themeId, resolvedMeetingId!);
      posthog.capture("theme_restored");
      await refreshPanelData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setRestoringThemeId(null);
    }
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
      await addUserTheme(resolvedMeetingId!, label, addThemeDescription.trim() || undefined);
      posthog.capture("theme_added_manually", { has_description: Boolean(addThemeDescription.trim()) });
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
        <CardContent className="space-y-4">
          {meetingQuery.isPending || themesQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Loading theme data…</p>
          ) : null}

          {meetingQuery.error || themesQuery.error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {getErrorMessage(meetingQuery.error ?? themesQuery.error)}
            </p>
          ) : null}

          {/* Empty state */}
          {!meetingQuery.isPending && !themesQuery.isPending && totalCount === 0 ? (
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

          {/* Themes exist — show tabs */}
          {!meetingQuery.isPending && !themesQuery.isPending && totalCount > 0 ? (
            <div className="space-y-4">
              <Tabs defaultValue="active">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <TabsList>
                    <TabsTrigger value="active">
                      Active{activeThemes.length > 0 ? ` (${activeThemes.length})` : ""}
                    </TabsTrigger>
                    <TabsTrigger value="rejected">
                      Rejected{rejectedThemeList.length > 0 ? ` (${rejectedThemeList.length})` : ""}
                    </TabsTrigger>
                  </TabsList>

                  {/* Actions alongside tabs */}
                  <div className="flex items-center gap-2">
                    {!addThemeOpen && !consultationIsLocked ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAddThemeOpen(true)}
                        disabled={isAddingTheme}
                      >
                        Add theme
                      </Button>
                    ) : null}
                    {allReviewed ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isExtracting}
                        onClick={() => setConfirmReextractOpen(true)}
                      >
                        {isExtracting ? <><LoadingSpinner />Extracting…</> : "Re-extract"}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {addThemeOpen ? (
                  <div className="mt-3">
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
                  </div>
                ) : null}

                {/* ── Active tab ── */}
                <TabsContent value="active" className="mt-3 space-y-3">
                  {activeThemes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active themes. All were rejected or none extracted yet.</p>
                  ) : null}

                  {!allReviewed && pendingThemes.length > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {acceptedThemes.length} of {activeThemes.length} themes reviewed
                    </p>
                  ) : null}

                  {allReviewed && acceptedThemes.length > 0 ? (
                    <p className="text-xs text-muted-foreground">Review complete. {acceptedThemes.length} themes accepted.</p>
                  ) : null}

                  <div className="space-y-3">
                    {activeThemes.map((theme) => {
                      const details = themeDetailsById[theme.id];
                      const confidence = getConfidenceLabel(details?.confidence);
                      const isAccepted = theme.accepted;
                      const isBusy = activeThemeId === theme.id;
                      const isCollapsing = collapsingIds.has(theme.id);

                      return (
                        <div
                          key={theme.id}
                          className={cn(
                            "overflow-hidden rounded-lg border p-4 transition-all duration-250",
                            isAccepted && "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20",
                            !isAccepted && "border-border/70",
                            isCollapsing && "max-h-0 p-0 opacity-0 border-0"
                          )}
                          style={isCollapsing ? { maxHeight: 0, padding: 0, opacity: 0, borderWidth: 0 } : undefined}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="font-medium">{theme.label}</p>
                              {(details?.description ?? theme.description) ? (
                                <p className="text-sm text-muted-foreground">{details?.description ?? theme.description}</p>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {theme.is_user_added ? (
                                <Badge
                                  variant="outline"
                                  className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
                                >
                                  User added
                                </Badge>
                              ) : (!isAccepted) ? (
                                <Badge
                                  variant="outline"
                                  className="border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300"
                                >
                                  AI suggested
                                </Badge>
                              ) : null}

                              {isAccepted ? (
                                <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200">
                                  Accepted
                                </Badge>
                              ) : (
                                <Badge variant="outline" className={confidence.className}>
                                  {confidence.label}
                                </Badge>
                              )}
                            </div>
                          </div>

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
                        </div>
                      );
                    })}
                  </div>

                  {/* Generate more — visible once themes exist */}
                  <div className="pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!transcript || isExtracting || isGeneratingMore}
                      onClick={() => void runExtraction({ generateMore: true })}
                    >
                      {isGeneratingMore ? (
                        <><LoadingSpinner />Generating…</>
                      ) : (
                        "Generate more insights"
                      )}
                    </Button>
                    {!transcript ? (
                      <p className="mt-1 text-xs text-muted-foreground">Add a transcript to generate more insights.</p>
                    ) : null}
                  </div>
                </TabsContent>

                {/* ── Rejected tab ── */}
                <TabsContent value="rejected" className="mt-3 space-y-3">
                  {rejectedThemeList.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No rejected themes yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {rejectedThemeList.map((theme) => {
                        const isRestoring = restoringThemeId === theme.id;
                        return (
                          <div
                            key={theme.id}
                            className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border/50 bg-muted/20 p-3 opacity-70"
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="font-medium line-through text-muted-foreground">{theme.label}</p>
                              {theme.description ? (
                                <p className="text-sm text-muted-foreground">{theme.description}</p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-muted-foreground">
                                Rejected
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isRestoring}
                                onClick={() => void handleRestore(theme.id)}
                              >
                                {isRestoring ? <LoadingSpinner /> : null}
                                Restore
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {/* Clarification */}
              <div className="border-t border-border/70 pt-4">
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto px-0 text-sm"
                  disabled={isClarifying || acceptedThemeLabels.length === 0}
                  onClick={() => void handleClarificationRequest()}
                >
                  {isClarifying ? (
                    <><LoadingSpinner />Loading clarification questions…</>
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
            <DialogDescription>This will replace active themes for this consultation with a new extraction. Previously rejected themes are preserved.</DialogDescription>
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

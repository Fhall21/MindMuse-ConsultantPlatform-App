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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeRejectionDialog } from "@/components/consultations/theme-rejection-dialog";
import { AddThemeForm } from "@/components/insights/add-theme-form";
import { ThemeReviewRow } from "@/components/insights/theme-review-row";


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

export function ThemePanel({ meetingId, consultationId }: ThemePanelProps) {
  const resolvedMeetingId = meetingId ?? consultationId;
  const queryClient = useQueryClient();
  const meetingQuery = useMeeting(resolvedMeetingId ?? "");
  const themesQuery = useMeetingThemes(resolvedMeetingId ?? "");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [restoringThemeId, setRestoringThemeId] = useState<string | null>(null);
  const [confirmReextractOpen, setConfirmReextractOpen] = useState(false);
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
      queryClient.invalidateQueries({ queryKey: ["quotes"] }),
      queryClient.invalidateQueries({ queryKey: ["canvas"] }),
      queryClient.invalidateQueries({ queryKey: ["grid-insights"] }),
      queryClient.invalidateQueries({ queryKey: ["grid-cells"] }),
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
                  Add insight
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
                        Add insight
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
                      const isAccepted = theme.accepted;
                      const isBusy = activeThemeId === theme.id;
                      const isCollapsing = collapsingIds.has(theme.id);

                      return (
                        <ThemeReviewRow
                          key={theme.id}
                          label={theme.label}
                          description={details?.description ?? theme.description}
                          confidence={details?.confidence}
                          decision={isAccepted ? "accepted" : undefined}
                          source={theme.is_user_added ? "user" : "ai"}
                          isBusy={isBusy}
                          actionsMode="always"
                          onAccept={() => void handleAccept(theme.id)}
                          onReject={() => openRejectionDialog(theme)}
                          className={cn(
                            isCollapsing && "max-h-0 p-0 opacity-0 border-0"
                          )}
                        />
                      );
                    })}
                  </div>

                  {/* Generate more — visible once themes exist */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
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
                    {!consultationIsLocked && !addThemeOpen ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAddThemeOpen(true)}
                        disabled={isAddingTheme}
                      >
                        Add insight
                      </Button>
                    ) : null}
                    {!transcript ? (
                      <p className="w-full text-xs text-muted-foreground">
                        Add a transcript to generate more insights.
                      </p>
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
            <DialogDescription>This will replace active themes for this project with a new extraction. Previously rejected themes are preserved.</DialogDescription>
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

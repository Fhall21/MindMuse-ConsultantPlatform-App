"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { acceptTheme, rejectTheme } from "@/lib/actions/themes";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Theme } from "@/types/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeRejectionDialog } from "@/components/consultations/theme-rejection-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConsultationSummary {
  id: string;
  title: string;
  status: string;
}

interface ThemeWithConsultation extends Theme {
  consultationId: string;
  consultationTitle: string;
}

interface ThemeRoundPanelProps {
  roundId: string;
  roundLabel: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function LoadingSpinner() {
  return <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Something went wrong. Please try again.";
}

// ─── Queries ──────────────────────────────────────────────────────────────────

function useRoundConsultations(roundId: string) {
  return useQuery({
    queryKey: ["consultations", "round", roundId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("consultations")
        .select("id, title, status")
        .eq("round_id", roundId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ConsultationSummary[];
    },
    enabled: !!roundId,
  });
}

function useRoundThemes(consultationIds: string[]) {
  return useQuery({
    queryKey: ["themes", "round-consultations", ...consultationIds],
    queryFn: async () => {
      if (consultationIds.length === 0) return [] as Theme[];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("themes")
        .select("*")
        .in("consultation_id", consultationIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Theme[];
    },
    enabled: consultationIds.length > 0,
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ThemeRoundPanel({ roundId, roundLabel }: ThemeRoundPanelProps) {
  const queryClient = useQueryClient();

  const consultationsQuery = useRoundConsultations(roundId);
  const consultationIds = useMemo(
    () => consultationsQuery.data?.map((c) => c.id) ?? [],
    [consultationsQuery.data]
  );
  const themesQuery = useRoundThemes(consultationIds);

  // Session-local rejected theme snapshots with rationale.
  // TODO: Agent 1 — extend rejectTheme to accept rationale and persist it in the DB.
  const [rejectedThemes, setRejectedThemes] = useState<Record<string, { rationale: string }>>({});

  // Rejection dialog state
  const [rejectionDialogTheme, setRejectionDialogTheme] = useState<ThemeWithConsultation | null>(null);

  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Build per-consultation theme groups
  const groupedThemes = useMemo(() => {
    const themes = themesQuery.data ?? [];
    const consultations = consultationsQuery.data ?? [];

    const map = new Map<string, ThemeWithConsultation[]>();

    for (const consultation of consultations) {
      map.set(consultation.id, []);
    }

    for (const theme of themes) {
      const list = map.get(theme.consultation_id);
      if (list) {
        const consultation = consultations.find((c) => c.id === theme.consultation_id);
        list.push({
          ...theme,
          consultationId: theme.consultation_id,
          consultationTitle: consultation?.title ?? "Untitled",
        });
      }
    }

    return consultations.map((c) => ({
      consultation: c,
      themes: map.get(c.id) ?? [],
    }));
  }, [consultationsQuery.data, themesQuery.data]);

  const totalThemes = themesQuery.data?.length ?? 0;
  const acceptedCount = themesQuery.data?.filter((t) => t.accepted).length ?? 0;
  const rejectedCount = Object.keys(rejectedThemes).length;

  async function refreshRoundData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["consultations", "round", roundId] }),
      queryClient.invalidateQueries({ queryKey: ["themes", "round-consultations", ...consultationIds] }),
    ]);
  }

  async function handleAccept(themeId: string, consultationId: string) {
    setErrorMessage(null);
    setActiveThemeId(themeId);
    try {
      await acceptTheme(themeId, consultationId);
      await refreshRoundData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setActiveThemeId(null);
    }
  }

  function openRejectionDialog(theme: ThemeWithConsultation) {
    setRejectionDialogTheme(theme);
  }

  async function handleRejectionConfirm(rationale: string) {
    const theme = rejectionDialogTheme;
    if (!theme) return;

    setErrorMessage(null);
    setActiveThemeId(theme.id);
    setRejectedThemes((current) => ({ ...current, [theme.id]: { rationale } }));
    setRejectionDialogTheme(null);

    try {
      await rejectTheme(theme.id, theme.consultationId, rationale);
      await refreshRoundData();
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

  const isLoading = consultationsQuery.isPending || themesQuery.isPending;
  const hasError = consultationsQuery.error ?? themesQuery.error;

  return (
    <>
      <Card className="border-border/70">
        <CardHeader>
          <div>
            <CardTitle>Round Themes — {roundLabel}</CardTitle>
            <CardDescription>
              All themes across consultations in this round. Review and triage per consultation.
            </CardDescription>
          </div>
          {totalThemes > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{totalThemes} total</Badge>
              {acceptedCount > 0 ? (
                <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200">
                  {acceptedCount} accepted
                </Badge>
              ) : null}
              {rejectedCount > 0 ? (
                <Badge variant="destructive">{rejectedCount} rejected</Badge>
              ) : null}
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading round themes…</p>
          ) : null}

          {hasError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {getErrorMessage(hasError)}
            </p>
          ) : null}

          {!isLoading && !hasError && consultationsQuery.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No consultations are assigned to this round yet.</p>
          ) : null}

          {!isLoading && !hasError && groupedThemes.map(({ consultation, themes }) => (
            <ConsultationThemeGroup
              key={consultation.id}
              consultation={consultation}
              themes={themes}
              rejectedThemes={rejectedThemes}
              activeThemeId={activeThemeId}
              onAccept={(themeId) => void handleAccept(themeId, consultation.id)}
              onReject={(theme) => openRejectionDialog(theme)}
            />
          ))}

          {errorMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <ThemeRejectionDialog
        open={rejectionDialogTheme !== null}
        themeLabel={rejectionDialogTheme?.label ?? ""}
        onConfirm={handleRejectionConfirm}
        onCancel={handleRejectionCancel}
      />
    </>
  );
}

// ─── Per-consultation theme group ─────────────────────────────────────────────

interface ConsultationThemeGroupProps {
  consultation: ConsultationSummary;
  themes: ThemeWithConsultation[];
  rejectedThemes: Record<string, { rationale: string }>;
  activeThemeId: string | null;
  onAccept: (themeId: string) => void;
  onReject: (theme: ThemeWithConsultation) => void;
}

function ConsultationThemeGroup({
  consultation,
  themes,
  rejectedThemes,
  activeThemeId,
  onAccept,
  onReject,
}: ConsultationThemeGroupProps) {
  return (
    <div className="space-y-3">
      {/* Consultation header — individual-consultation scope is visually distinct */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border/60" />
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{consultation.title}</span>
          {consultation.status === "complete" ? (
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              Complete
            </Badge>
          ) : null}
        </div>
        <div className="h-px flex-1 bg-border/60" />
      </div>

      {themes.length === 0 ? (
        <p className="pl-1 text-xs text-muted-foreground">No themes for this consultation.</p>
      ) : (
        <div className="space-y-2">
          {themes.map((theme) => {
            const isRejectedSession = !!rejectedThemes[theme.id];
            const isAccepted = theme.accepted && !isRejectedSession;
            const isBusy = activeThemeId === theme.id;

            return (
              <div
                key={theme.id}
                className={cn(
                  "rounded-md border p-3 transition-colors",
                  isAccepted && "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20",
                  isRejectedSession && "border-destructive/30 bg-destructive/5 opacity-75"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className={cn("text-sm font-medium", isRejectedSession && "line-through")}>
                      {theme.label}
                    </p>
                    {theme.description ? (
                      <p className="text-xs text-muted-foreground">{theme.description}</p>
                    ) : null}
                    {isRejectedSession && rejectedThemes[theme.id]?.rationale ? (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Rationale:</span>{" "}
                        {rejectedThemes[theme.id].rationale}
                      </p>
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
                    ) : null}
                    {isAccepted ? (
                      <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200">
                        Accepted
                      </Badge>
                    ) : null}
                    {isRejectedSession ? (
                      <Badge variant="destructive">Rejected</Badge>
                    ) : null}
                    {!isAccepted && !isRejectedSession ? (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          disabled={isBusy}
                          onClick={() => onAccept(theme.id)}
                        >
                          {isBusy ? <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={isBusy}
                          onClick={() => onReject(theme)}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

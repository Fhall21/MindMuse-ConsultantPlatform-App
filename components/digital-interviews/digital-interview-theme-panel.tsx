"use client";

import { useState } from "react";
import { toast } from "sonner";
import { fetchJson } from "@/hooks/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDigitalInterviewThemes,
  useAcceptDigitalInterviewTheme,
  useRejectDigitalInterviewTheme,
  useSaveDigitalInterviewThemes,
} from "@/hooks/use-digital-interview-themes";
import type { DigitalInterviewTheme } from "@/lib/data/digital-interview-themes";
import { cn } from "@/lib/utils";

interface DigitalInterviewThemePanelProps {
  flowId: string;
  hasResponses: boolean;
}

function LoadingSpinner() {
  return <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

function ThemeCard({
  theme,
  onAccept,
  onReject,
  busy,
}: {
  theme: DigitalInterviewTheme;
  onAccept: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-colors",
        theme.accepted && "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium">{theme.label}</p>
          {theme.description ? (
            <p className="text-sm text-muted-foreground">{theme.description}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {theme.accepted ? (
            <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              Accepted
            </Badge>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={onReject}
                disabled={busy}
                className="border-destructive/30 text-destructive hover:bg-destructive/5"
              >
                Reject
              </Button>
              <Button size="sm" onClick={onAccept} disabled={busy}>
                {busy ? <LoadingSpinner /> : "Accept"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function DigitalInterviewThemePanel({
  flowId,
  hasResponses,
}: DigitalInterviewThemePanelProps) {
  const { data: themes = [], isPending, error } = useDigitalInterviewThemes(flowId);
  const saveThemes = useSaveDigitalInterviewThemes(flowId);
  const acceptTheme = useAcceptDigitalInterviewTheme(flowId);
  const rejectTheme = useRejectDigitalInterviewTheme(flowId);

  const [isExtracting, setIsExtracting] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);

  const pendingThemes = themes.filter((t) => !t.accepted);
  const acceptedThemes = themes.filter((t) => t.accepted);

  async function handleExtract(replaceExisting = false) {
    if (!replaceExisting && themes.length > 0) {
      const confirmed = window.confirm(
        "This will replace the existing extracted themes. Continue?"
      );
      if (!confirmed) return;
    }

    setIsExtracting(true);
    try {
      const result = await fetchJson<{ themes?: Array<{ label: string; description?: string }> }>(
        `/api/client/digital-interviews/${flowId}/extract-themes`,
        { method: "POST" }
      );

      const extracted = result.themes ?? [];
      if (extracted.length === 0) {
        toast.info("No themes found in this interview.");
        return;
      }

      await saveThemes.mutateAsync(extracted);
      toast.success(`${extracted.length} theme${extracted.length === 1 ? "" : "s"} extracted.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to extract themes.");
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleAccept(themeId: string) {
    setActiveThemeId(themeId);
    try {
      await acceptTheme.mutateAsync(themeId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept theme.");
    } finally {
      setActiveThemeId(null);
    }
  }

  async function handleReject(themeId: string) {
    setActiveThemeId(themeId);
    try {
      await rejectTheme.mutateAsync(themeId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject theme.");
    } finally {
      setActiveThemeId(null);
    }
  }

  return (
    <Card className="border-border/70">
      <CardContent className="space-y-4">
        {isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : null}

        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Failed to load themes.
          </p>
        ) : null}

        {!isPending && !error && themes.length === 0 ? (
          <div className="space-y-3 rounded-lg border border-dashed border-border/80 bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">No themes extracted yet.</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={!hasResponses || isExtracting}
                onClick={() => void handleExtract(true)}
              >
                {isExtracting ? (
                  <>
                    <LoadingSpinner />
                    Extracting…
                  </>
                ) : (
                  "Extract themes"
                )}
              </Button>
              {!hasResponses ? (
                <p className="text-xs text-muted-foreground">
                  No completed responses yet.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {!isPending && !error && themes.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {acceptedThemes.length} of {themes.length} themes accepted
              </p>
              <Button
                size="sm"
                variant="outline"
                disabled={isExtracting}
                onClick={() => void handleExtract(false)}
              >
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

            {pendingThemes.length > 0 ? (
              <div className="space-y-2">
                {pendingThemes.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    busy={activeThemeId === theme.id}
                    onAccept={() => void handleAccept(theme.id)}
                    onReject={() => void handleReject(theme.id)}
                  />
                ))}
              </div>
            ) : null}

            {acceptedThemes.length > 0 ? (
              <div className="space-y-2">
                {pendingThemes.length > 0 ? (
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Accepted
                  </p>
                ) : null}
                {acceptedThemes.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    busy={false}
                    onAccept={() => {}}
                    onReject={() => void handleReject(theme.id)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

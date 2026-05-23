"use client";

/**
 * Canvas-page "Generate report" button.
 *
 * Purpose: removes the manual capture-then-attach step. Clicking this button
 * (i) captures the current canvas DOM, (ii) calls the existing report
 * generation server action with the captured payload, and (iii) navigates the
 * consultant to the new report. The report renders per-frame images of the
 * consultant's spatial arrangement so the live view never diverges from what
 * they just built.
 *
 * Why client-side capture: html2canvas only works against a live DOM. Server-
 * side generation can't see node positions / handle offsets / Tailwind oklch
 * styling without spinning up a browser, which we don't want for v1.
 *
 * Why piggyback on the existing action: the user explicitly does NOT want a
 * second "attach" step. Capture must be a side effect of the normal "Generate
 * report" flow.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateRoundReportWithTemplate } from "@/lib/actions/consultation-workflow";
import { useReportTemplates } from "@/hooks/use-report-templates";
import type { CanvasEdge, CanvasFrame } from "@/types/canvas";

interface Props {
  roundId: string;
  frames: CanvasFrame[];
  edges: CanvasEdge[];
}

export function GenerateReportFromCanvasButton({ roundId, frames, edges }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: templates = [] } = useReportTemplates();
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const activeTemplates = useMemo(
    () => templates.filter((t) => t.is_active),
    [templates]
  );

  // Default to the user's default template, or first active one.
  useEffect(() => {
    if (selectedTemplateId || activeTemplates.length === 0) return;
    const defaultTemplate = activeTemplates.find((t) => t.is_default);
    setSelectedTemplateId(defaultTemplate?.id ?? activeTemplates[0]?.id ?? null);
  }, [activeTemplates, selectedTemplateId]);

  const selectedTemplate = activeTemplates.find((t) => t.id === selectedTemplateId);

  const runGeneration = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      // Capture is best-effort. If it fails (WebGL fallback, hidden tab),
      // we still let report generation proceed without imagery so the
      // consultant never gets blocked.
      let capturedPayload: {
        full: string;
        frames: Record<string, string>;
        capturedAt: string;
      } | null = null;
      try {
        const { captureCanvasImages } = await import("@/lib/canvas-snapshot");
        const { buildCanvasImagePayload } = await import("@/lib/report-canvas-assets");
        const captured = await captureCanvasImages(frames, edges);
        if (captured) {
          capturedPayload = await buildCanvasImagePayload(captured);
        }
      } catch (captureError) {
        console.warn("[generate-from-canvas] capture failed, generating without imagery", captureError);
      }

      const result = await generateRoundReportWithTemplate(
        roundId,
        selectedTemplateId,
        capturedPayload
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["report_artifacts"] }),
        queryClient.invalidateQueries({
          queryKey: ["report_artifact_versions", roundId, "report"],
        }),
      ]);

      toast.success(
        capturedPayload
          ? "Report generated with canvas layout."
          : "Report generated (canvas capture unavailable)."
      );
      posthog.capture("report_generated", {
        source: "canvas_page",
        round_id: roundId,
        artifact_type: "report",
        with_canvas: capturedPayload !== null,
        frame_count: frames.length,
      });

      // Open the new report so the consultant sees the result immediately.
      if (result?.id) {
        router.push(`/reports/${result.id}`);
      }
    } catch (error) {
      console.error("[generate-from-canvas] failed", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to generate report"
      );
    } finally {
      setIsGenerating(false);
    }
  }, [edges, frames, isGenerating, queryClient, roundId, router, selectedTemplateId]);

  return (
    <div className="flex items-center">
      <Button
        size="sm"
        onClick={runGeneration}
        disabled={isGenerating}
        className="gap-1.5 rounded-r-none"
      >
        {isGenerating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileText className="h-3.5 w-3.5" />
        )}
        Generate report
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            disabled={isGenerating}
            className="rounded-l-none border-l border-l-primary-foreground/20 px-2"
            aria-label="Choose report template"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs font-medium">
            Template
            {selectedTemplate && (
              <span className="ml-1 text-muted-foreground">
                · {selectedTemplate.name}
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {activeTemplates.length === 0 && (
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              No active templates. Generation will use the built-in default.
            </DropdownMenuItem>
          )}
          {activeTemplates.map((template) => (
            <DropdownMenuItem
              key={template.id}
              onSelect={() => setSelectedTemplateId(template.id)}
              className="flex items-start gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">
                  {template.name}
                  {template.is_default && (
                    <span className="ml-1 text-[10px] text-muted-foreground">(default)</span>
                  )}
                </div>
                {template.description && (
                  <div className="truncate text-[10px] text-muted-foreground">
                    {template.description}
                  </div>
                )}
              </div>
              {selectedTemplateId === template.id && (
                <span className="text-xs text-primary">✓</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

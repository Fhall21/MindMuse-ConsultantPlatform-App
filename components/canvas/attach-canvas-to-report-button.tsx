"use client";

/**
 * Toolbar control that captures the current canvas and attaches the PNG to
 * a chosen report version. Closes the canvas ↔ report fidelity gap: the
 * consultant arranges spatially, picks a report, and the report now opens
 * with their exact layout as the hero visual.
 *
 * Capture happens client-side (canvas DOM not available server-side).
 * Persistence is a single `attachCanvasImageToReport` server action call.
 */
import { useCallback, useState } from "react";
import { Camera, ChevronDown, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { attachCanvasImageToReport } from "@/lib/actions/reports";
import { useReportArtifactVersions } from "@/hooks/use-reports";
import type { CanvasEdge, CanvasFrame } from "@/types/canvas";

interface Props {
  roundId: string;
  frames: CanvasFrame[];
  edges: CanvasEdge[];
}

export function AttachCanvasToReportButton({ roundId, frames, edges }: Props) {
  const [busyReportId, setBusyReportId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const reportsQuery = useReportArtifactVersions(roundId, "report");

  const handleAttach = useCallback(
    async (reportId: string, reportTitle: string) => {
      if (busyReportId) return;
      setBusyReportId(reportId);
      try {
        const { captureCanvasImages } = await import("@/lib/canvas-snapshot");
        const { buildCanvasImagePayload } = await import("@/lib/report-canvas-assets");
        const captured = await captureCanvasImages(frames, edges);
        if (!captured) {
          toast.error("Canvas capture failed — try again with the canvas visible.");
          return;
        }
        const payload = await buildCanvasImagePayload(captured);
        const result = await attachCanvasImageToReport({
          artifactId: reportId,
          canvasImage: payload,
        });
        if (!result.updated) {
          toast.error("Report not found or no longer accessible.");
          return;
        }
        toast.success(`Canvas attached to "${reportTitle}".`);
        // Refresh the report detail view so the new hero image appears.
        queryClient.invalidateQueries({ queryKey: ["report_artifact", reportId] });
      } catch (error) {
        console.error("[attach-canvas] failed", error);
        toast.error("Failed to attach canvas. Please try again.");
      } finally {
        setBusyReportId(null);
      }
    },
    [busyReportId, edges, frames, queryClient]
  );

  const reports = reportsQuery.data ?? [];
  const isBusy = busyReportId !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={isBusy} className="gap-1.5">
          {isBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
          Attach to report
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs font-medium">
          Attach this canvas snapshot to…
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {reportsQuery.isLoading && (
          <DropdownMenuItem disabled>Loading reports…</DropdownMenuItem>
        )}
        {!reportsQuery.isLoading && reports.length === 0 && (
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            No reports yet for this round. Generate one first.
          </DropdownMenuItem>
        )}
        {reports.map((report, idx) => {
          const label = report.title || `Report v${reports.length - idx}`;
          const isThis = busyReportId === report.id;
          return (
            <DropdownMenuItem
              key={report.id}
              disabled={isBusy}
              onSelect={(event) => {
                // Keep the dropdown's default close behaviour but kick off
                // the async work after it closes.
                event.preventDefault();
                void handleAttach(report.id, label);
              }}
              className="flex items-start gap-2"
            >
              {isThis && <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{label}</div>
                <div className="text-[10px] text-muted-foreground">
                  Generated {new Date(report.generatedAt).toLocaleString()}
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

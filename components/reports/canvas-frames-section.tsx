"use client";

/**
 * Renders one card per canvas frame with the frame's captured cropped image
 * inline. This is the per-frame fidelity surface for reports: the consultant
 * sees their spatial groupings (a "Workload" frame, a "Communication" frame,
 * etc.) reproduced section-by-section rather than as a flat list.
 *
 * Empty state: nothing renders if there are no frames. We deliberately do not
 * push a "no frames yet" message — reports without frames stay clean.
 *
 * Image fallback: when a frame's image is missing (capture skipped the frame
 * because it was outside viewport, or the report predates capture wiring),
 * the card still renders with name + colour swatch so the textual structure
 * never breaks.
 */
import { Layers } from "lucide-react";
import type { ReportGraphFrameModel } from "@/lib/report-graph";

interface CanvasFramesSectionProps {
  frames: ReportGraphFrameModel[];
  /** Map of frame id → data URL of the cropped capture, when available. */
  frameImages: Record<string, string> | null | undefined;
}

export function CanvasFramesSection({ frames, frameImages }: CanvasFramesSectionProps) {
  if (frames.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Layers className="h-3.5 w-3.5" />
          Canvas frames
        </h3>
        <span className="text-xs text-muted-foreground">
          {frames.length} {frames.length === 1 ? "frame" : "frames"}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {frames.map((frame) => {
          const imageUrl = frameImages?.[frame.id] ?? null;
          return (
            <article
              key={frame.id}
              className="overflow-hidden rounded-lg border border-border/60 bg-background"
              style={
                frame.color
                  ? { borderColor: `${frame.color}40`, boxShadow: `inset 4px 0 0 ${frame.color}` }
                  : undefined
              }
            >
              <header className="flex items-center justify-between gap-2 border-b border-border/40 bg-muted/20 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  {frame.color && (
                    <span
                      aria-hidden
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: frame.color }}
                    />
                  )}
                  <h4 className="truncate text-sm font-medium">{frame.name}</h4>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {frame.nodeIds.length}{" "}
                  {frame.nodeIds.length === 1 ? "insight" : "insights"}
                </span>
              </header>

              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={`Captured layout of frame "${frame.name}"`}
                  className="block h-auto w-full bg-muted/10"
                />
              ) : (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No captured image for this frame.
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

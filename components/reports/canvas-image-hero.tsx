"use client";

/**
 * Renders the captured canvas image as the report's hero visual.
 *
 * Purpose: the consultant's spatial arrangement on the canvas (frames,
 * connections, colours, grouping) must survive into the report. This
 * component pulls the persisted PNG off the report artifact and shows it
 * up top, so what the consultant arranged is the first thing the reader
 * sees — no flattening, no surprise.
 *
 * Empty state: when no snapshot has been attached yet, we render an
 * actionable nudge linking back to the canvas page where the user can
 * capture and attach.
 */
import Link from "next/link";
import { ImageOff, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CONNECTION_COLORS, CONNECTION_TYPE_LABELS } from "@/lib/canvas-constants";
import type { ConnectionType } from "@/types/canvas";

interface CanvasImageHeroProps {
  /** The full-canvas PNG as a data URL, or null when not yet captured. */
  imageDataUrl: string | null | undefined;
  /** ISO timestamp the capture was taken. */
  capturedAt?: string;
  /** Round id, used to deep-link back to the canvas if user wants to refresh. */
  roundId: string;
}

const LEGEND_TYPES: ConnectionType[] = [
  "causes",
  "influences",
  "supports",
  "contradicts",
  "context",
  "related_to",
];

export function CanvasImageHero({ imageDataUrl, capturedAt, roundId }: CanvasImageHeroProps) {
  if (!imageDataUrl) {
    return (
      <section className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-6 print:hidden">
        <div className="flex items-start gap-3">
          <ImageOff className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="space-y-2">
            <h3 className="text-sm font-medium">No canvas snapshot attached</h3>
            <p className="text-xs text-muted-foreground">
              Reports show your canvas layout — frames, connections, and
              positioning — exactly as you arranged it. Open the canvas and
              click <span className="font-medium">"Attach to report"</span> on
              the toolbar to capture the current view.
            </p>
            <Link
              href={`/canvas/round/${roundId}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open canvas
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Layers className="h-3.5 w-3.5" />
          Canvas overview
        </h3>
        {capturedAt && (
          <p className="text-xs text-muted-foreground">
            Captured {new Date(capturedAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Hero image. Border + soft shadow so it reads as a "framed visual" */}
      {/* not just an inline diagram. */}
      <div className="overflow-hidden rounded-lg border border-border/60 bg-background shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageDataUrl}
          alt="Captured canvas layout showing insights, frames and connections"
          className="block h-auto w-full"
        />
      </div>

      {/* Legend mirrors the connection colours used on the canvas itself */}
      {/* so readers can map an arrow back to its meaning. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Legend
        </span>
        {LEGEND_TYPES.map((type) => (
          <Badge
            key={type}
            variant="outline"
            className="gap-1.5 border-border/50 bg-background text-[10px] font-normal"
          >
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: CONNECTION_COLORS[type] }}
            />
            {CONNECTION_TYPE_LABELS[type]}
          </Badge>
        ))}
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LiteratureFigure } from "@/hooks/use-research";

type FigureImage = { url: string; alt?: string };

interface FigureImageGridProps {
  images: FigureImage[];
  /** Optional caption shown under each thumbnail (grid) or in lightbox header. */
  getCaption?: (index: number) => string | undefined;
  className?: string;
  /** Compact grid for reasoning rounds; roomier for Figures tab. */
  variant?: "compact" | "panel";
}

export function FigureImageGrid({
  images,
  getCaption,
  className,
  variant = "compact",
}: FigureImageGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const active = lightboxIndex !== null ? images[lightboxIndex] : null;
  const activeCaption =
    lightboxIndex !== null ? getCaption?.(lightboxIndex) : undefined;

  if (images.length === 0) return null;

  return (
    <>
      <ul
        className={cn(
          "grid gap-2",
          variant === "panel"
            ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
            : "grid-cols-2 sm:grid-cols-3",
          className
        )}
      >
        {images.map((img, i) => {
          const caption = getCaption?.(i);
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => setLightboxIndex(i)}
                className="group block w-full overflow-hidden rounded-md border bg-muted/20 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.alt ?? caption ?? `Figure ${i + 1}`}
                  className="aspect-[4/3] w-full object-contain p-1"
                />
                {caption && variant === "panel" && (
                  <p className="border-t px-2 py-1.5 text-[10px] leading-snug text-muted-foreground line-clamp-2">
                    {caption}
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <Dialog
        open={lightboxIndex !== null}
        onOpenChange={(open) => {
          if (!open) setLightboxIndex(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
          {active && (
            <>
              <DialogHeader className="space-y-1 border-b px-4 py-3 text-left">
                <DialogTitle className="text-sm font-medium leading-snug">
                  {activeCaption ?? `Figure ${(lightboxIndex ?? 0) + 1}`}
                </DialogTitle>
              </DialogHeader>
              <div className="max-h-[calc(90vh-4rem)] overflow-auto bg-muted/10 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={active.url}
                  alt={active.alt ?? activeCaption ?? "Figure preview"}
                  className="mx-auto max-h-[70vh] w-auto max-w-full object-contain"
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function literatureFigureCaption(fig: LiteratureFigure): string {
  const parts = [
    fig.citation_key,
    fig.query ? `“${fig.query}”` : undefined,
  ].filter(Boolean);
  return parts.join(" · ");
}

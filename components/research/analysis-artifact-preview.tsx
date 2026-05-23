"use client";

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  AnalysisArtifact,
  AnalysisResult,
} from "@/hooks/use-research";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AnswerText } from "./answer-text";

const TEXT_PREVIEW_MAX_CHARS = 8000;

export function artifactDownloadHref(entryId: string): string {
  return `/api/research/analysis/artifacts/${encodeURIComponent(entryId)}`;
}

function isFetchableTextMime(mimeType: string): boolean {
  return mimeType === "text/csv" || mimeType === "application/json";
}

function TextPreviewBlock({
  text,
  truncated,
  compact,
}: {
  text: string;
  truncated?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "mt-2" : "mt-3"}>
      <pre
        className={cn(
          "overflow-auto rounded-md border bg-muted/20 p-3 text-xs whitespace-pre-wrap break-words text-foreground/90",
          compact ? "max-h-[200px]" : "max-h-[320px]"
        )}
      >
        {text}
      </pre>
      {truncated && (
        <p className="mt-1 text-xs text-muted-foreground">… truncated</p>
      )}
    </div>
  );
}

function FetchedTextPreview({
  entryId,
  compact,
}: {
  entryId: string;
  compact?: boolean;
}) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "text"; text: string; truncated: boolean }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void fetch(artifactDownloadHref(entryId))
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        const truncated = text.length > TEXT_PREVIEW_MAX_CHARS;
        setState({
          kind: "text",
          text: truncated ? text.slice(0, TEXT_PREVIEW_MAX_CHARS) : text,
          truncated,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: (err as Error).message || "Failed to load preview",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [entryId]);

  if (state.kind === "loading") {
    return (
      <p
        className={cn(
          "flex items-center gap-1.5 text-xs text-muted-foreground",
          compact ? "mt-2" : "mt-3"
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading preview…
      </p>
    );
  }
  if (state.kind === "error") {
    return (
      <p className={cn("text-xs text-destructive", compact ? "mt-2" : "mt-3")}>
        {state.message}
      </p>
    );
  }
  return (
    <TextPreviewBlock
      text={state.text}
      truncated={state.truncated}
      compact={compact}
    />
  );
}

export async function downloadArtifact(entryId: string, filename: string) {
  try {
    const res = await fetch(artifactDownloadHref(entryId));
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast.error((err as Error).message || "Download failed");
  }
}

export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function filenameBasename(filename: string): string {
  const slash = Math.max(filename.lastIndexOf("/"), filename.lastIndexOf("\\"));
  const name = slash >= 0 ? filename.slice(slash + 1) : filename;
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(0, dot) : name;
}

function textContainsNormalized(text: string, candidate: string): boolean {
  const norm = normalizeForMatch(candidate);
  if (norm.length < 3) return false;
  return normalizeForMatch(text).includes(norm);
}

function matchCandidates(raw: string): string[] {
  const out = new Set<string>([raw]);
  out.add(raw.replace(/-/g, "_"));
  out.add(raw.replace(/_/g, "-"));
  return [...out];
}

export function artifactReferencedInText(
  art: AnalysisArtifact,
  text: string
): boolean {
  const candidates = new Set<string>([
    art.entry_id,
    art.filename,
    ...matchCandidates(art.entry_id),
    ...matchCandidates(art.filename),
  ]);
  const base = filenameBasename(art.filename);
  if (base.length >= 6) {
    for (const c of matchCandidates(base)) candidates.add(c);
  }
  for (const c of candidates) {
    if (textContainsNormalized(text, c)) return true;
  }
  return false;
}

export function figureReferencedInText(
  fig: { alt: string },
  text: string
): boolean {
  if (!fig.alt) return false;
  for (const c of matchCandidates(fig.alt)) {
    if (textContainsNormalized(text, c)) return true;
  }
  const base = filenameBasename(fig.alt);
  if (base.length >= 6) {
    for (const c of matchCandidates(base)) {
      if (textContainsNormalized(text, c)) return true;
    }
  }
  return false;
}

export interface AnalysisFigure {
  key: string;
  src: string;
  alt: string;
  href: string;
}

/** Collect every image produced by the analysis: inline cell outputs + image
 * artifacts. Cell outputs ship as base64 inside the result; artifacts use the
 * proxy URL so size is unbounded. */
export function collectFigures(result: AnalysisResult): AnalysisFigure[] {
  const figures: AnalysisFigure[] = [];
  for (const [ci, cell] of (result.notebook_cells ?? []).entries()) {
    for (const [oi, out] of (cell.outputs ?? []).entries()) {
      if (out.output_type !== "display_data" && out.output_type !== "execute_result") {
        continue;
      }
      const png = out.data?.["image/png"];
      const jpeg = out.data?.["image/jpeg"];
      const src = png
        ? `data:image/png;base64,${png}`
        : jpeg
          ? `data:image/jpeg;base64,${jpeg}`
          : null;
      if (!src) continue;
      figures.push({
        key: `cell-${ci}-${oi}`,
        src,
        href: src,
        alt: cell.display_text || `Cell ${cell.execution_count ?? ci} output`,
      });
    }
  }
  for (const art of result.artifacts ?? []) {
    if (!art.mime_type.startsWith("image/")) continue;
    const proxy = artifactDownloadHref(art.entry_id);
    figures.push({
      key: `art-${art.entry_id}`,
      src: art.inline_data_url ?? proxy,
      href: proxy,
      alt: art.filename,
    });
  }
  return figures;
}

export function ArtifactPreviewCard({
  artifact,
  compact = false,
}: {
  artifact: AnalysisArtifact;
  compact?: boolean;
}) {
  const isImage = artifact.mime_type.startsWith("image/");
  const downloadHref = artifactDownloadHref(artifact.entry_id);
  const showFetchedPreview =
    !artifact.inline_text && isFetchableTextMime(artifact.mime_type);

  return (
    <div
      className={cn(
        "rounded-lg border bg-card",
        compact ? "p-2.5" : "p-3"
      )}
    >
      <div className="flex items-start gap-3">
        <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-medium", compact ? "text-xs" : "text-sm")}>
            {artifact.filename}
          </p>
          <p className="text-xs text-muted-foreground">
            {artifact.mime_type}
            {artifact.size_bytes != null &&
              ` · ${(artifact.size_bytes / 1024).toFixed(1)} KB`}
          </p>
          {artifact.error && (
            <p className="mt-1 text-xs text-destructive">{artifact.error}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size={compact ? "sm" : "sm"}
          className={compact ? "h-7 px-2 text-xs" : undefined}
          onClick={() => void downloadArtifact(artifact.entry_id, artifact.filename)}
        >
          <Download className={cn("h-3.5 w-3.5", !compact && "mr-1.5")} />
          {!compact && "Download"}
        </Button>
      </div>
      {artifact.inline_text && (
        <TextPreviewBlock
          text={
            artifact.inline_text.length > TEXT_PREVIEW_MAX_CHARS
              ? artifact.inline_text.slice(0, TEXT_PREVIEW_MAX_CHARS)
              : artifact.inline_text
          }
          truncated={artifact.inline_text.length > TEXT_PREVIEW_MAX_CHARS}
          compact={compact}
        />
      )}
      {showFetchedPreview && (
        <FetchedTextPreview entryId={artifact.entry_id} compact={compact} />
      )}
      {isImage && (
        <a
          href={downloadHref}
          target="_blank"
          rel="noopener noreferrer"
          className="group block"
        >
          <img
            src={artifact.inline_data_url ?? downloadHref}
            alt={artifact.filename}
            loading="lazy"
            className={cn(
              "mt-2 w-full rounded-md border bg-muted/20 object-contain",
              compact ? "max-h-[240px]" : "max-h-[480px]"
            )}
          />
        </a>
      )}
    </div>
  );
}

export function FigurePreviewCard({
  figure,
  compact = false,
}: {
  figure: AnalysisFigure;
  compact?: boolean;
}) {
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-md border bg-card",
        compact ? "max-w-xl" : undefined
      )}
    >
      <a
        href={figure.href}
        target="_blank"
        rel="noopener noreferrer"
        className="group block transition-colors hover:border-foreground/30"
      >
        <img
          src={figure.src}
          alt={figure.alt}
          loading="lazy"
          className="block h-auto w-full bg-muted/20 object-contain"
        />
      </a>
      {figure.alt && (
        <figcaption
          className={cn(
            "border-t px-3 py-1.5 text-muted-foreground",
            compact ? "text-[11px]" : "text-xs"
          )}
        >
          {figure.alt}
        </figcaption>
      )}
    </figure>
  );
}

function splitAnswerSections(answer: string): { heading?: string; body: string }[] {
  if (!answer.includes("## ")) {
    return [{ body: answer }];
  }
  const parts = answer.split(/(?=^## )/m);
  const sections: { heading?: string; body: string }[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("## ")) {
      const newline = trimmed.indexOf("\n");
      if (newline === -1) {
        sections.push({ heading: trimmed.slice(3).trim(), body: "" });
      } else {
        sections.push({
          heading: trimmed.slice(3, newline).trim(),
          body: trimmed.slice(newline + 1).trim(),
        });
      }
    } else {
      sections.push({ body: trimmed });
    }
  }
  return sections.length > 0 ? sections : [{ body: answer }];
}

export function AnalysisSummaryContent({ result }: { result: AnalysisResult }) {
  const answer = result.answer || "_No summary returned._";
  const artifacts = result.artifacts ?? [];
  const figures = collectFigures(result);
  const sections = splitAnswerSections(answer);

  const { sectionBlocks, remainingArtifacts, remainingFigures, anyReferenced } =
    (() => {
      const shownArtifactIds = new Set<string>();
      const shownFigureKeys = new Set<string>();

      const sectionBlocks = sections.map((section) => {
        const sectionText = [section.heading, section.body].filter(Boolean).join("\n");
        const sectionArtifacts = artifacts.filter(
          (a) =>
            !shownArtifactIds.has(a.entry_id) &&
            artifactReferencedInText(a, sectionText)
        );
        const sectionFigures = figures.filter(
          (f) =>
            !shownFigureKeys.has(f.key) && figureReferencedInText(f, sectionText)
        );
        sectionArtifacts.forEach((a) => {
          shownArtifactIds.add(a.entry_id);
          if (a.mime_type.startsWith("image/")) {
            shownFigureKeys.add(`art-${a.entry_id}`);
          }
        });
        sectionFigures.forEach((f) => {
          shownFigureKeys.add(f.key);
          if (f.key.startsWith("art-")) {
            shownArtifactIds.add(f.key.slice(4));
          }
        });
        return { section, sectionArtifacts, sectionFigures };
      });

      const remainingArtifacts = artifacts.filter(
        (a) =>
          !shownArtifactIds.has(a.entry_id) && artifactReferencedInText(a, answer)
      );
      const remainingFigures = figures.filter(
        (f) => !shownFigureKeys.has(f.key) && figureReferencedInText(f, answer)
      );

      const anyReferenced =
        artifacts.some((a) => artifactReferencedInText(a, answer)) ||
        figures.some((f) => figureReferencedInText(f, answer));

      return {
        sectionBlocks,
        remainingArtifacts,
        remainingFigures,
        anyReferenced,
      };
    })();

  const fallbackArtifacts = artifacts.filter(
    (a) => !a.mime_type.startsWith("image/")
  );

  return (
    <div className="border-t pt-4">
      {sectionBlocks.map(({ section, sectionArtifacts, sectionFigures }, i) => (
        <div key={i} className={i > 0 ? "mt-6" : undefined}>
          {section.heading && (
            <h3 className="mb-2 text-base font-semibold text-foreground">
              {section.heading}
            </h3>
          )}
          <AnswerText text={section.body || (section.heading ? "" : answer)} />
          {(sectionArtifacts.length > 0 || sectionFigures.length > 0) && (
            <div className="mt-3 space-y-2">
              {sectionArtifacts.map((art) => (
                <ArtifactPreviewCard key={art.entry_id} artifact={art} compact />
              ))}
              {sectionFigures.map((fig) => (
                <FigurePreviewCard key={fig.key} figure={fig} compact />
              ))}
            </div>
          )}
        </div>
      ))}

      {(remainingArtifacts.length > 0 || remainingFigures.length > 0) && (
        <div className="mt-4 space-y-2">
          {remainingArtifacts.map((art) => (
            <ArtifactPreviewCard key={art.entry_id} artifact={art} compact />
          ))}
          {remainingFigures.map((fig) => (
            <FigurePreviewCard key={fig.key} figure={fig} compact />
          ))}
        </div>
      )}

      {!anyReferenced && (fallbackArtifacts.length > 0 || figures.length > 0) && (
        <section className="mt-6 space-y-3">
          <h3 className="text-sm font-medium text-foreground/80">Outputs</h3>
          <div className="space-y-2">
            {fallbackArtifacts.map((art) => (
              <ArtifactPreviewCard key={art.entry_id} artifact={art} compact />
            ))}
            {figures.map((fig) => (
              <FigurePreviewCard key={fig.key} figure={fig} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AnalysisNotebookCell,
  AnalysisCellOutput,
} from "@/hooks/use-research";

/**
 * Lightweight Python syntax tinting. Intentionally minimal — we are not
 * rebuilding VS Code; we just want subtle differentiation between keywords,
 * strings, comments, and numbers so the code is scannable.
 */
const PY_KEYWORDS = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break",
  "class", "continue", "def", "del", "elif", "else", "except", "finally", "for",
  "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not",
  "or", "pass", "raise", "return", "try", "while", "with", "yield", "match",
  "case",
]);

const TOKEN_RE =
  /(#[^\n]*)|(\"\"\"[\s\S]*?\"\"\"|'''[\s\S]*?''')|(r?\"(?:\\.|[^\"\\])*\"|r?'(?:\\.|[^'\\])*')|\b(\d+\.?\d*)\b|\b([A-Za-z_]\w*)\b|([(){}\[\],:;.])/g;

function highlightPython(code: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(code)) !== null) {
    if (match.index > lastIdx) {
      nodes.push(code.slice(lastIdx, match.index));
    }
    const [full, comment, tripleStr, str, num, ident] = match;
    if (comment) {
      nodes.push(
        <span key={key++} className="text-muted-foreground/70 italic">
          {comment}
        </span>
      );
    } else if (tripleStr || str) {
      nodes.push(
        <span key={key++} className="text-emerald-700 dark:text-emerald-400">
          {tripleStr ?? str}
        </span>
      );
    } else if (num) {
      nodes.push(
        <span key={key++} className="text-amber-700 dark:text-amber-300">
          {num}
        </span>
      );
    } else if (ident) {
      if (PY_KEYWORDS.has(ident)) {
        nodes.push(
          <span key={key++} className="text-violet-700 dark:text-violet-300 font-medium">
            {ident}
          </span>
        );
      } else {
        nodes.push(ident);
      }
    } else {
      nodes.push(full);
    }
    lastIdx = match.index + full.length;
  }
  if (lastIdx < code.length) {
    nodes.push(code.slice(lastIdx));
  }
  return nodes;
}

function CellOutput({ output }: { output: AnalysisCellOutput }) {
  if (output.output_type === "stream") {
    if (!output.text) return null;
    return (
      <pre
        className={cn(
          "whitespace-pre-wrap break-words font-mono text-xs leading-relaxed",
          output.name === "stderr" ? "text-destructive" : "text-foreground/85"
        )}
      >
        {output.text}
      </pre>
    );
  }
  if (output.output_type === "execute_result" || output.output_type === "display_data") {
    const png = output.data?.["image/png"];
    const jpeg = output.data?.["image/jpeg"];
    const html = output.data?.["text/html"];
    const text = output.data?.["text/plain"];
    return (
      <div className="space-y-2">
        {png && (
          <img
            src={`data:image/png;base64,${png}`}
            alt="Notebook output"
            className="max-h-[480px] max-w-full rounded-md border"
          />
        )}
        {jpeg && (
          <img
            src={`data:image/jpeg;base64,${jpeg}`}
            alt="Notebook output"
            className="max-h-[480px] max-w-full rounded-md border"
          />
        )}
        {html && !png && !jpeg && (
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            // Edison-trusted HTML; not user-supplied.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
        {text && !png && !jpeg && !html && (
          <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground/85">
            {text}
          </pre>
        )}
      </div>
    );
  }
  if (output.output_type === "error") {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
        <p className="font-medium text-destructive">
          {output.ename ?? "Error"}: {output.evalue}
        </p>
        {output.traceback && (
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-destructive/80">
            {output.traceback}
          </pre>
        )}
      </div>
    );
  }
  return null;
}

interface NotebookCellsProps {
  cells: AnalysisNotebookCell[];
  /** When true, the last cell is shown with an in-progress shimmer. */
  isLive?: boolean;
  /** Compact (panel) vs roomy (detail page). */
  variant?: "panel" | "detail";
}

export function NotebookCells({
  cells,
  isLive = false,
  variant = "panel",
}: NotebookCellsProps) {
  if (cells.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No notebook cells yet. Edison is preparing the analysis kernel.
      </p>
    );
  }

  const lastIdx = cells.length - 1;

  return (
    <div className={cn(variant === "panel" ? "space-y-3" : "space-y-4")}>
      {cells.map((cell, idx) => {
        const isLast = idx === lastIdx;
        const inProgress = isLive && isLast && cell.outputs.length === 0;
        const isError = cell.status === "error";
        const label =
          cell.execution_count != null ? `In [${cell.execution_count}]` : `In [ ]`;
        return (
          <article
            key={`${cell.index}-${cell.execution_count ?? idx}`}
            className={cn(
              "rounded-md border bg-card",
              isError && "border-destructive/30",
              inProgress && "ring-1 ring-primary/30"
            )}
          >
            <header className="flex items-start gap-3 border-b bg-muted/40 px-3 py-1.5 text-xs">
              <span
                className={cn(
                  "font-mono shrink-0",
                  isError ? "text-destructive" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
              {cell.display_text && (
                <span className="text-foreground/80 truncate">
                  {cell.display_text}
                </span>
              )}
              <span className="ml-auto flex items-center gap-1 text-muted-foreground">
                {inProgress && <Loader2 className="h-3 w-3 animate-spin" />}
                {isError && (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    error
                  </span>
                )}
              </span>
            </header>

            <pre className="overflow-x-auto px-3 py-2 font-mono text-xs leading-relaxed">
              <code>{highlightPython(cell.code)}</code>
            </pre>

            {cell.outputs.length > 0 && (
              <div className="space-y-2 border-t bg-muted/20 px-3 py-2">
                {cell.outputs.map((out, oi) => (
                  <CellOutput key={oi} output={out} />
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { HoverCard as HoverCardPrimitive } from "radix-ui";
import type { EvidenceExcerpt, LiteratureReference } from "@/hooks/use-research";
import { cn } from "@/lib/utils";
import { CitationChip } from "./citation-chip";

interface AnswerTextProps {
  text: string;
  references?: LiteratureReference[];
  evidence?: EvidenceExcerpt[];
  onCitationClick?: (num: string) => void;
}

function evidenceLabel(id: string) {
  const match = /(\d+)$/.exec(id);
  return match ? `E${Number(match[1])}` : id;
}

function EvidenceChip({ item }: { item: EvidenceExcerpt }) {
  const score = Number(item.score);
  const scoreLabel =
    Number.isFinite(score) && score > 1
      ? `${score.toFixed(0)}/10`
      : Number.isFinite(score)
      ? `${(score * 100).toFixed(0)}%`
      : null;

  return (
    <HoverCardPrimitive.Root openDelay={280} closeDelay={100}>
      <HoverCardPrimitive.Trigger asChild>
        <span
          className={cn(
            "mx-0.5 inline-flex h-[1.35em] items-center rounded px-[0.35em]",
            "align-baseline text-[0.75em] font-semibold leading-none tabular-nums",
            "ring-1 ring-inset ring-border text-muted-foreground",
            "underline decoration-dotted underline-offset-2 decoration-muted-foreground/40",
            "cursor-default select-none"
          )}
          aria-label={`Evidence ${item.id}`}
        >
          {evidenceLabel(item.id)}
        </span>
      </HoverCardPrimitive.Trigger>
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Content
          align="start"
          side="top"
          sideOffset={6}
          avoidCollisions
          className={cn(
            "z-50 w-80 rounded-md border bg-popover p-3 shadow-md",
            "ring-1 ring-foreground/8 text-sm text-popover-foreground",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          )}
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex h-4 items-center rounded bg-muted px-1.5 text-[10px] font-bold text-muted-foreground/70">
              {evidenceLabel(item.id)}
            </span>
            {scoreLabel && (
              <span className="text-[11px] tabular-nums text-muted-foreground/60">
                {scoreLabel}
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {item.question}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            {item.excerpt}
          </p>
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  );
}

function parseTableRow(row: string) {
  return row
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

type TextSegment =
  | { type: "paragraph"; content: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

function parseTextSegments(lines: string[]): TextSegment[] {
  const segments: TextSegment[] = [];
  let paragraphLines: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushParagraph = () => {
    const content = paragraphLines.join("\n").trim();
    if (content) segments.push({ type: "paragraph", content });
    paragraphLines = [];
  };

  const flushList = () => {
    if (list && list.items.length > 0) {
      segments.push(list);
      list = null;
    }
  };

  for (const line of lines) {
    // Require marker + space at line start (after 0–4 space indent). Bare dashes
    // or mid-sentence "word - word" must not become list items.
    const ulMatch = /^( {0,4})[-*+] (.+)$/.exec(line);
    const olMatch = /^( {0,4})\d+\. (.+)$/.exec(line);

    if (ulMatch) {
      flushParagraph();
      if (list?.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(ulMatch[2]);
    } else if (olMatch) {
      flushParagraph();
      if (list?.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(olMatch[2]);
    } else if (line.trim()) {
      flushList();
      paragraphLines.push(line);
    }
  }

  flushParagraph();
  flushList();
  return segments;
}

/**
 * Renders a literature-research answer with light markdown headings and
 * interactive citation chips. Pass `references` to enable hover previews and
 * `onCitationClick` to enable tab-switching when a citation is clicked.
 */
export function AnswerText({
  text,
  references = [],
  evidence = [],
  onCitationClick,
}: AnswerTextProps) {
  const refByNumber = new Map(references.map((r) => [String(r.number), r]));
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));

  const renderInline = (value: string) => {
    const parts = value.split(/(\[\d+(?:\.\d+)?(?:,\s*\d+(?:\.\d+)?)*\]|pqac-\d+)/g);
    const nodes: ReactNode[] = [];

    parts.forEach((part, index) => {
      const citMatch = /^\[(\d+(?:\.\d+)?(?:,\s*\d+(?:\.\d+)?)*)\]$/.exec(part);
      if (citMatch) {
        citMatch[1].split(",").map((n) => n.trim()).forEach((n) => {
          const baseNum = n.split(".")[0];
          nodes.push(
            <CitationChip
              key={`${index}-${n}`}
              num={n}
              reference={refByNumber.get(baseNum)}
              onCitationClick={() => onCitationClick?.(baseNum)}
            />
          );
        });
        return;
      }

      const evidenceItem = evidenceById.get(part);
      if (evidenceItem) {
        nodes.push(<EvidenceChip key={`${index}-${part}`} item={evidenceItem} />);
        return;
      }

      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      if (boldParts.length === 1) {
        nodes.push(<span key={index}>{part}</span>);
      } else {
        boldParts.forEach((bp, bi) => {
          const bold = /^\*\*([^*]+)\*\*$/.exec(bp);
          nodes.push(
            bold ? (
              <strong key={`${index}-${bi}`}>{bold[1]}</strong>
            ) : (
              <span key={`${index}-${bi}`}>{bp}</span>
            )
          );
        });
      }
    });

    return nodes;
  };

  const blocks: { type: "table" | "text"; lines: string[] }[] = [];
  let current: string[] = [];
  let inTable = false;

  const flush = () => {
    if (current.length > 0) {
      blocks.push({ type: inTable ? "table" : "text", lines: current });
      current = [];
    }
  };

  text.split("\n").forEach((line) => {
    const isTableLine = line.trim().startsWith("|");
    const isHeadingLine = /^#{2,3}\s+/.test(line.trim());

    if (isHeadingLine) {
      flush();
      inTable = false;
      blocks.push({ type: "text", lines: [line] });
      return;
    }

    if (isTableLine !== inTable) {
      flush();
      inTable = isTableLine;
    }
    if (!isTableLine && !line.trim()) {
      flush();
      inTable = false;
      return;
    }
    current.push(line);
  });
  flush();

  return (
    <div className="space-y-4 text-sm leading-relaxed">
      {blocks.map((block, bi) => {
        const trimmed = block.lines.join("\n").trim();
        if (!trimmed) return null;

        if (block.type === "table") {
          const rows = block.lines
            .map((line) => line.trim())
            .filter((line) => line.startsWith("|") && !line.match(/^\|[-| :]+\|$/));
          if (rows.length < 2) return null;

          const [headerRow, ...bodyRows] = rows;
          const headers = parseTableRow(headerRow);

          return (
            <div key={bi} className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[960px] table-fixed text-sm">
                <thead className="bg-muted/35">
                  <tr>
                    {headers.map((header, hi) => (
                      <th
                        key={hi}
                        className="px-3 py-2 text-left align-bottom text-xs font-semibold text-foreground"
                      >
                        {renderInline(header)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bodyRows.map((row, ri) => (
                    <tr key={ri}>
                      {parseTableRow(row).map((cell, ci) => (
                        <td
                          key={ci}
                          className="px-3 py-3 align-top text-sm leading-relaxed text-muted-foreground"
                        >
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        const h2 = /^## (.+)/.exec(trimmed);
        if (h2) {
          return (
            <h3 key={bi} className="pt-2 text-base font-semibold text-foreground">
              {h2[1]}
            </h3>
          );
        }
        const h3 = /^### (.+)/.exec(trimmed);
        if (h3) {
          return (
            <h4 key={bi} className="text-sm font-semibold text-foreground">
              {h3[1]}
            </h4>
          );
        }

        const segments = parseTextSegments(block.lines);
        if (segments.length === 0) return null;

        return (
          <div key={bi} className="space-y-2">
            {segments.map((segment, si) => {
              if (segment.type === "paragraph") {
                return <p key={si}>{renderInline(segment.content)}</p>;
              }
              if (segment.type === "ul") {
                return (
                  <ul
                    key={si}
                    className="list-inside list-disc space-y-1 pl-1 text-muted-foreground"
                  >
                    {segment.items.map((item, ii) => (
                      <li key={ii}>{renderInline(item)}</li>
                    ))}
                  </ul>
                );
              }
              return (
                <ol
                  key={si}
                  className="list-inside list-decimal space-y-1 pl-1 text-muted-foreground"
                >
                  {segment.items.map((item, ii) => (
                    <li key={ii}>{renderInline(item)}</li>
                  ))}
                </ol>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import type { LiteratureReference } from "@/hooks/use-research";
import { CitationChip } from "./citation-chip";

interface AnswerTextProps {
  text: string;
  references?: LiteratureReference[];
  onCitationClick?: (num: string) => void;
}

/**
 * Renders a literature-research answer with light markdown headings and
 * interactive citation chips. Pass `references` to enable hover previews and
 * `onCitationClick` to enable tab-switching when a citation is clicked.
 */
export function AnswerText({ text, references = [], onCitationClick }: AnswerTextProps) {
  const refByNumber = new Map(references.map((r) => [String(r.number), r]));
  const blocks = text.split(/\n\n+/);

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {blocks.map((block, bi) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        const h2 = /^## (.+)/.exec(trimmed);
        if (h2) {
          return (
            <h3 key={bi} className="text-base font-semibold text-foreground pt-1">
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

        // Paragraph with inline citation chips
        const parts = trimmed.split(/(\[\d+(?:,\s*\d+)*\])/g);
        return (
          <p key={bi}>
            {parts.map((part, pi) => {
              const citMatch = /^\[(\d+(?:,\s*\d+)*)\]$/.exec(part);
              if (citMatch) {
                const nums = citMatch[1].split(",").map((n) => n.trim());
                return (
                  <span key={pi}>
                    {nums.map((n) => (
                      <CitationChip
                        key={n}
                        num={n}
                        reference={refByNumber.get(n)}
                        onCitationClick={onCitationClick}
                      />
                    ))}
                  </span>
                );
              }
              return <span key={pi}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

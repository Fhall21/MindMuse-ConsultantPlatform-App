"use client";

import type { LiteratureReference } from "@/hooks/use-research";

interface ReferencesListProps {
  references: LiteratureReference[];
}

export function ReferencesList({ references }: ReferencesListProps) {
  if (references.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No references available.</p>
    );
  }

  return (
    <ol className="space-y-3">
      {references.map((ref) => (
        <li
          key={ref.number}
          className="flex gap-3 rounded-lg border bg-card p-3 text-sm"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
            {ref.number}
          </span>
          <div className="min-w-0 space-y-0.5">
            {ref.url ? (
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium leading-snug text-foreground underline-offset-2 hover:underline"
              >
                {ref.title}
              </a>
            ) : (
              <p className="font-medium leading-snug text-foreground">{ref.title}</p>
            )}
            <p className="text-muted-foreground">
              {[ref.authors, ref.year && `(${ref.year})`, ref.journal]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReasoningSteps } from "@/components/research/reasoning-steps";
import { ReferencesList } from "@/components/research/references-list";
import { useResearchSession } from "@/hooks/use-research";
import type { LiteratureResult, EvidenceExcerpt } from "@/hooks/use-research";

// ── Local display helpers ─────────────────────────────────────────────────────

function AnswerText({ text }: { text: string }) {
  const blocks = text.split(/\n\n+/);
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {blocks.map((block, bi) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        const h2 = /^## (.+)/.exec(trimmed);
        if (h2) return <h3 key={bi} className="text-base font-semibold pt-1">{h2[1]}</h3>;
        const h3 = /^### (.+)/.exec(trimmed);
        if (h3) return <h4 key={bi} className="text-sm font-semibold">{h3[1]}</h4>;
        const parts = trimmed.split(/(\[\d+(?:,\s*\d+)*\])/g);
        return (
          <p key={bi}>
            {parts.map((part, pi) => {
              const citMatch = /^\[(\d+(?:,\s*\d+)*)\]$/.exec(part);
              if (citMatch) {
                return (
                  <span key={pi}>
                    {citMatch[1].split(",").map((n) => (
                      <Badge
                        key={n.trim()}
                        variant="outline"
                        className="mx-0.5 px-1 py-0 text-xs font-semibold align-super"
                      >
                        {n.trim()}
                      </Badge>
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

function ArtifactTable({ markdown }: { markdown: string }) {
  const rows = markdown
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r.startsWith("|") && !r.match(/^\|[-| ]+\|$/));
  if (rows.length < 2) return null;
  const parseRow = (row: string) =>
    row.split("|").slice(1, -1).map((c) => c.trim());
  const [headerRow, ...bodyRows] = rows;
  const headers = parseRow(headerRow);
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, ri) => (
            <tr key={ri} className="border-t">
              {parseRow(row).map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-muted-foreground">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EvidenceList({ evidence }: { evidence: EvidenceExcerpt[] }) {
  if (evidence.length === 0)
    return <p className="text-sm text-muted-foreground">No evidence excerpts available.</p>;
  return (
    <div className="space-y-3">
      {evidence.map((item) => (
        <div key={item.id} className="rounded-lg border bg-card p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">{item.question}</p>
            <Badge variant="secondary" className="shrink-0 text-xs">score {item.score}</Badge>
          </div>
          <p className="text-sm leading-relaxed">{item.excerpt}</p>
        </div>
      ))}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "pending")
    return <Badge variant="secondary" className="text-xs font-normal text-muted-foreground">Queued</Badge>;
  if (status === "running")
    return (
      <Badge variant="secondary" className="gap-1 text-xs font-normal text-blue-700 dark:text-blue-300">
        <Loader2 className="h-3 w-3 animate-spin" /> Searching
      </Badge>
    );
  if (status === "failed")
    return <Badge variant="outline" className="text-xs border-destructive/40 text-destructive">Failed</Badge>;
  return null;
}

// ── Results view ──────────────────────────────────────────────────────────────

function ResultView({ result }: { result: LiteratureResult }) {
  return (
    <Tabs defaultValue="results">
      <TabsList>
        <TabsTrigger value="results">Results</TabsTrigger>
        <TabsTrigger value="reasoning">
          Reasoning
          {result.reasoning_steps.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {result.reasoning_steps.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="evidence">
          Evidence
          {result.evidence.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {result.evidence.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="references">
          References
          {result.references.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {result.references.length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="results" className="mt-3 space-y-4">
        {result.artifact && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
            <ArtifactTable markdown={result.artifact} />
          </div>
        )}
        <div className="border-t pt-4">
          <AnswerText text={result.answer} />
        </div>
      </TabsContent>

      <TabsContent value="reasoning" className="mt-3">
        <ReasoningSteps steps={result.reasoning_steps} />
      </TabsContent>

      <TabsContent value="evidence" className="mt-3">
        <EvidenceList evidence={result.evidence} />
      </TabsContent>

      <TabsContent value="references" className="mt-3">
        <ReferencesList references={result.references} />
      </TabsContent>
    </Tabs>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResearchSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, isLoading, error } = useResearchSession(id);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Link
          href="/research"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Research
        </Link>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-24" />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">Could not load research session.</p>
        )}

        {session && (
          <>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">{session.query}</h1>
                <StatusBadge status={session.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(session.createdAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>

            {/* In-flight */}
            {(session.status === "pending" || session.status === "running") && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                <span>
                  {session.status === "pending"
                    ? "Queued — waiting to start"
                    : "Searching scientific databases — usually 30–90 seconds"}
                </span>
              </div>
            )}

            {/* Failed */}
            {session.status === "failed" && (
              <p className="text-sm text-destructive">
                {(session.resultData as { error?: string } | null)?.error ??
                  "Search failed. Please try again."}
              </p>
            )}

            {/* Complete */}
            {session.status === "complete" && session.resultData && (
              <ResultView result={session.resultData as unknown as LiteratureResult} />
            )}
            {session.status === "complete" && !session.resultData && (
              <p className="text-sm text-muted-foreground">No results were returned for this search.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useRef } from "react";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAIPreferences } from "@/hooks/use-ai-preferences";
import { useLiteratureResearch } from "@/hooks/use-research";
import { EvidenceList } from "./evidence-list";
import { ReasoningSteps } from "./reasoning-steps";
import { ReferencesList } from "./references-list";

// Render Edison answer text: light markdown heading support + [N, M] citation badges.
function AnswerText({ text }: { text: string }) {
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

        // Paragraph with inline citation badges
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
                      <Badge
                        key={n}
                        variant="outline"
                        className="mx-0.5 px-1 py-0 text-xs font-semibold align-super"
                      >
                        {n}
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

// Render an Edison artifact (markdown table) as a styled HTML table.
function ArtifactTable({ markdown }: { markdown: string }) {
  const rows = markdown
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r.startsWith("|") && !r.match(/^\|[-| ]+\|$/));

  if (rows.length < 2) return null;

  const parseRow = (row: string) =>
    row
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

  const [headerRow, ...bodyRows] = rows;
  const headers = parseRow(headerRow);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, ri) => (
            <tr key={ri} className="border-t">
              {parseRow(row).map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-muted-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LiteraturePanel() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: preferences } = useAIPreferences();
  const {
    status,
    result,
    error,
    elapsedSeconds,
    pollingMessage,
    reasoningSteps,
    submit,
    reset,
  } = useLiteratureResearch();

  const industry = preferences?.industry || undefined;
  const isLoading = status === "submitted" || status === "polling";
  const hasResult = status === "complete" && result !== null;
  const showLiveReasoning = isLoading && reasoningSteps.length > 0;

  const handleSubmit = () => {
    const query = textareaRef.current?.value.trim();
    if (!query || isLoading) return;
    submit(query, industry);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const activeSteps = hasResult ? result.reasoning_steps : reasoningSteps;
  const activeEvidence = hasResult ? result.evidence : [];
  const activeReferences = hasResult ? result.references : [];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          ref={textareaRef}
          placeholder="What does the literature say about…"
          className="min-h-[80px] resize-none"
          disabled={isLoading}
          onKeyDown={handleKeyDown}
        />
        <div className="flex items-center gap-2">
          <Button onClick={handleSubmit} disabled={isLoading} size="sm">
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Search literature
          </Button>
          {(hasResult || status === "error") && (
            <Button variant="ghost" size="sm" onClick={reset}>
              New search
            </Button>
          )}
          {industry && (
            <span className="text-xs text-muted-foreground">
              Context: {industry}
            </span>
          )}
        </div>
      </div>

      {status === "error" && error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-destructive">Search failed</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* Loading state: spinner + live reasoning steps */}
      {isLoading && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {pollingMessage || "Searching literature"}
              </p>
              <p className="text-xs text-muted-foreground">
                Usually 30–90 seconds
                {elapsedSeconds > 0 && ` · ${elapsedSeconds}s elapsed`}
              </p>
            </div>
          </div>

          {showLiveReasoning && (
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Agent steps
              </p>
              <ReasoningSteps steps={reasoningSteps} isLoading />
            </div>
          )}
        </div>
      )}

      {/* Results tabs — shown at completion */}
      {hasResult && (
        <Tabs defaultValue="results" className="w-full">
          <TabsList>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="reasoning">
              Reasoning
              {activeSteps.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                  {activeSteps.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="evidence">
              Evidence
              {activeEvidence.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                  {activeEvidence.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="references">
              References
              {activeReferences.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                  {activeReferences.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="mt-3 space-y-3">
            {result.artifact && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Summary
                </p>
                <ArtifactTable markdown={result.artifact} />
              </div>
            )}
            <ScrollArea className="max-h-[480px] rounded-lg border bg-card p-4">
              <AnswerText text={result.answer} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="reasoning" className="mt-3">
            <div className="rounded-lg border bg-card p-4">
              <ReasoningSteps steps={activeSteps} />
            </div>
          </TabsContent>

          <TabsContent value="evidence" className="mt-3">
            <ScrollArea className="max-h-[480px]">
              <EvidenceList evidence={activeEvidence} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="references" className="mt-3">
            <ScrollArea className="max-h-[480px]">
              <ReferencesList references={activeReferences} />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

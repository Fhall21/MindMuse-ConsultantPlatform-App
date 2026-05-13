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
import { ReasoningSteps } from "./reasoning-steps";
import { ReferencesList } from "./references-list";

function AnswerText({ text }: { text: string }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <p className="text-sm leading-relaxed">
      {parts.map((part, i) => {
        const match = /^\[(\d+)\]$/.exec(part);
        if (match) {
          return (
            <Badge
              key={i}
              variant="outline"
              className="mx-0.5 px-1 py-0 text-xs font-semibold align-super"
            >
              {match[1]}
            </Badge>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

export function LiteraturePanel() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: preferences } = useAIPreferences();
  const { status, result, error, elapsedSeconds, reasoningSteps, submit, reset } =
    useLiteratureResearch();

  const industry = preferences?.industry || undefined;
  const isLoading = status === "submitted" || status === "polling";
  const hasResult = status === "complete" && result !== null;

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

      {isLoading && (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/30 p-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Searching literature</p>
            <p className="text-xs text-muted-foreground">
              Usually 30–90 seconds
              {elapsedSeconds > 0 && ` · ${elapsedSeconds}s elapsed`}
            </p>
          </div>
          {reasoningSteps.length > 0 && (
            <div className="w-full max-w-sm text-left">
              <ReasoningSteps steps={reasoningSteps} />
            </div>
          )}
        </div>
      )}

      {status === "error" && error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-destructive">Search failed</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {hasResult && (
        <Tabs defaultValue="results" className="w-full">
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
            <TabsTrigger value="references">
              References
              {result.references.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                  {result.references.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="mt-3">
            <ScrollArea className="max-h-[480px] rounded-lg border bg-card p-4">
              <AnswerText text={result.answer} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="reasoning" className="mt-3">
            <div className="rounded-lg border bg-card p-4">
              <ReasoningSteps steps={result.reasoning_steps} />
            </div>
          </TabsContent>

          <TabsContent value="references" className="mt-3">
            <ScrollArea className="max-h-[480px]">
              <ReferencesList references={result.references} />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

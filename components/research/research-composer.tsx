"use client";

import { useRef } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAIPreferences } from "@/hooks/use-ai-preferences";
import { useCreateResearchSession } from "@/hooks/use-research";

export function ResearchComposer() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const { data: preferences } = useAIPreferences();
  const createSession = useCreateResearchSession();

  const industry = preferences?.industry ?? undefined;

  const handleSubmit = async () => {
    const query = textareaRef.current?.value.trim();
    if (!query || createSession.isPending) return;

    try {
      const { id } = await createSession.mutateAsync({
        query,
        session_type: "literature",
        industry_ctx: industry ?? null,
      });
      router.push(`/research/${id}`);
    } catch {
      toast.error("Failed to start research session. Please try again.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        ref={textareaRef}
        placeholder="What does the literature say about…"
        className="min-h-[80px] resize-none"
        disabled={createSession.isPending}
        onKeyDown={handleKeyDown}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => void handleSubmit()}
          disabled={createSession.isPending}
          size="sm"
        >
          <Search className="mr-2 h-4 w-4" />
          Search literature
        </Button>
        {industry && (
          <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground">
            {industry}
          </span>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { BookOpenCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useResearchExtractionEnabled } from "@/hooks/use-feature-flags";

const DISMISS_KEY = "research-extractor-hint-dismissed";

/**
 * Discoverability banner shown above the research answer when extraction is
 * enabled. Explains the otherwise-hidden text-selection affordance. The banner
 * dismisses to localStorage so a returning user only sees it once.
 */
const DISMISS_KEYS = {
  literature: DISMISS_KEY,
  analysis: "research-extractor-hint-dismissed-analysis",
} as const;

export function ResearchExtractorHint({
  className,
  sessionType = "literature",
}: {
  className?: string;
  sessionType?: "literature" | "analysis";
}) {
  const enabled = useResearchExtractionEnabled();
  const dismissKey = DISMISS_KEYS[sessionType];
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(dismissKey) === "1");
  }, [dismissKey]);

  if (!enabled || dismissed) return null;

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(dismissKey, "1");
    }
    setDismissed(true);
  };

  const tipCopy =
    sessionType === "analysis" ? (
      <>
        Select any passage in the summary or artifact previews to{" "}
        <em>Add as insight</em>. The quote lands on a project canvas with
        the analysis session attached.
      </>
    ) : (
      <>
        Select any passage in the answer to <em>Add as insight</em>. The
        extracted quote lands on a project canvas with the source citation
        attached, and appears in your report&rsquo;s References section.
      </>
    );

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border border-stone-200 bg-stone-50 px-3 py-2.5",
        "dark:border-stone-800 dark:bg-stone-900/40",
        className
      )}
      role="note"
      data-testid="research-extractor-hint"
    >
      <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0 text-stone-600 dark:text-stone-300" />
      <div className="min-w-0 flex-1 text-xs leading-relaxed text-stone-700 dark:text-stone-300">
        <span className="font-semibold">Tip — </span>
        {tipCopy}
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 w-6 shrink-0 p-0 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
        onClick={handleDismiss}
        aria-label="Dismiss tip"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

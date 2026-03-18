"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RoundOutputCollection } from "@/types/round-detail";

interface RoundOutputsSectionProps {
  roundId: string;
  outputs: RoundOutputCollection;
  onGenerateSummary: (roundId: string) => Promise<void>;
  onGenerateReport: (roundId: string) => Promise<void>;
  onGenerateEmail: (roundId: string) => Promise<void>;
}

const outputTypeLabels: Record<string, string> = {
  summary: "Round Summary",
  report: "Round Report",
  email: "Round Email",
};

const statusBadgeConfig: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "",
  },
  generating: {
    label: "Generating...",
    className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
  },
  ready: {
    label: "Ready",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  failed: {
    label: "Failed",
    className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
  },
};

export function RoundOutputsSection({
  roundId,
  outputs,
  onGenerateSummary,
  onGenerateReport,
  onGenerateEmail,
}: RoundOutputsSectionProps) {
  const [generating, setGenerating] = useState<string | null>(null);

  async function handleGenerate(
    type: string,
    fn: (roundId: string) => Promise<void>
  ) {
    setGenerating(type);
    try {
      await fn(roundId);
    } finally {
      setGenerating(null);
    }
  }

  const outputMap = new Map(
    (["summary", "report", "email"] as const).map((type) => [type, outputs[type]])
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Round Outputs</CardTitle>
        <CardDescription>
          Generate summaries, reports, and emails from this round&apos;s accepted themes and groups.
          Outputs are generated manually, not automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(["summary", "report", "email"] as const).map((type) => {
          const output = outputMap.get(type);
          const statusConfig = output
            ? statusBadgeConfig[output.status] ?? statusBadgeConfig.pending
            : null;

          return (
            <div
              key={type}
              className="flex items-center justify-between rounded-md border px-3 py-2.5"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{outputTypeLabels[type]}</p>
                {output?.generatedAt ? (
                  <p className="text-xs text-muted-foreground">
                    Generated {new Date(output.generatedAt).toLocaleDateString()}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Not yet generated</p>
                )}
                {output?.error ? (
                  <p className="text-xs text-destructive">{output.error}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {statusConfig ? (
                  <Badge variant="outline" className={statusConfig.className}>
                    {statusConfig.label}
                  </Badge>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={generating !== null}
                  onClick={() => {
                    const fn =
                      type === "summary"
                        ? onGenerateSummary
                        : type === "report"
                          ? onGenerateReport
                          : onGenerateEmail;
                    void handleGenerate(type, fn);
                  }}
                >
                  {generating === type
                    ? "Generating..."
                    : output
                      ? "Regenerate"
                      : "Generate"}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RoundOutputCollection } from "@/types/round-detail";
import type { ReportTemplate } from "@/types/db";

interface RoundOutputsSectionProps {
  roundId: string;
  outputs: RoundOutputCollection;
  templates: ReportTemplate[];
  onGenerateSummary: (roundId: string) => Promise<void>;
  onGenerateReport: (roundId: string, templateId: string | null) => Promise<void>;
  onGenerateEmail: (roundId: string) => Promise<void>;
}

const outputTypeLabels: Record<string, string> = {
  summary: "Consultation Summary",
  report: "Consultation Report",
  email: "Evidence Email",
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
  templates,
  onGenerateSummary,
  onGenerateReport,
  onGenerateEmail,
}: RoundOutputsSectionProps) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [reportTemplateId, setReportTemplateId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && templates.length > 0) {
      const active = templates.find((t) => t.is_active);
      setReportTemplateId(active?.id ?? null);
      setInitialized(true);
    }
  }, [templates, initialized]);

  async function handleGenerate(
    type: string,
    fn: () => Promise<void>
  ) {
    setGenerating(type);
    try {
      await fn();
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
        <CardTitle className="text-base">Consultation Outputs</CardTitle>
        <CardDescription>
          Generate summaries, reports, and emails from this consultation&apos;s accepted themes and groups.
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
              className="flex items-center justify-between rounded-md border px-3 py-2.5 gap-3"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-medium">{outputTypeLabels[type]}</p>
                {output?.generatedAt ? (
                  <p className="text-xs text-muted-foreground">
                    Generated {new Date(output.generatedAt).toLocaleDateString()}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Not yet generated</p>
                )}
              </div>

              {/* Template selector — only for the "report" row */}
              {type === "report" && templates.length > 0 && (
                <Select
                  value={reportTemplateId ?? "__none__"}
                  onValueChange={(val) =>
                    setReportTemplateId(val === "__none__" ? null : val)
                  }
                >
                  <SelectTrigger className="h-7 w-44 text-xs">
                    <SelectValue placeholder="No template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-xs">
                      No template
                    </SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.name}
                        {t.is_active ? " ★" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="flex shrink-0 items-center gap-2">
                {statusConfig ? (
                  <Badge variant="outline" className={statusConfig.className}>
                    {statusConfig.label}
                  </Badge>
                ) : null}
                {output ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    asChild
                  >
                    <Link href={`/reports/${output.id}`}>View</Link>
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={generating !== null}
                  onClick={() => {
                    void handleGenerate(type, () => {
                      if (type === "summary") return onGenerateSummary(roundId);
                      if (type === "report") return onGenerateReport(roundId, reportTemplateId);
                      return onGenerateEmail(roundId);
                    });
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

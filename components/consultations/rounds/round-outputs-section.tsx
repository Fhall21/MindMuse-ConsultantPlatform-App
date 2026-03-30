"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
      const activeTemplates = templates.filter((t) => t.is_active);
      const defaultTemplate = activeTemplates.find((t) => t.is_default);
      setReportTemplateId(defaultTemplate?.id ?? activeTemplates[0]?.id ?? null);
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

          return (
            <div
              key={type}
              className="space-y-3 border-b border-border/60 py-3 last:border-b-0"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{outputTypeLabels[type]}</p>
                    {output?.generatedAt ? (
                      <p className="text-xs text-muted-foreground">
                        Generated {new Date(output.generatedAt).toLocaleDateString()}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not yet generated</p>
                    )}
                  </div>

                  {type === "report" && templates.some((t) => t.is_active) ? (
                    <div className="max-w-xs space-y-1.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Report template
                      </p>
                      <Select
                        value={reportTemplateId ?? "__none__"}
                        onValueChange={(val) =>
                          setReportTemplateId(val === "__none__" ? null : val)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="No template" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__" className="text-xs">
                            No template
                          </SelectItem>
                          {templates.filter((t) => t.is_active).map((t) => (
                            <SelectItem key={t.id} value={t.id} className="text-xs">
                              {t.name}
                              {t.is_default ? " (default)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2 self-start">
                  {output ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      asChild
                    >
                      <Link href={`/reports/${output.id}`}>View</Link>
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
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
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

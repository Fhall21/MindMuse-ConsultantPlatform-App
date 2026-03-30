"use client";

import { useCallback, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import posthog from "posthog-js";
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
import { generateRoundReportWithTemplate } from "@/lib/actions/consultation-workflow";
import { useConsultations } from "@/hooks/use-consultations";
import { useReportTemplates } from "@/hooks/use-report-templates";
import type { Consultation, ReportTemplate } from "@/types/db";

export function ReportGenerationCard() {
  const queryClient = useQueryClient();
  const { data: rounds = [] } = useConsultations();
  const { data: templates = [] } = useReportTemplates();

  const [selectedRoundId, setSelectedRoundId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Initialize template to default active template on load
  useEffect(() => {
    if (!selectedTemplateId && templates.length > 0) {
      const activeTemplates = templates.filter((t) => t.is_active);
      const defaultTemplate = activeTemplates.find((t) => t.is_default);
      setSelectedTemplateId(defaultTemplate?.id ?? activeTemplates[0]?.id ?? null);
    }
  }, [templates, selectedTemplateId]);

  const handleGenerate = useCallback(async () => {
    if (!selectedRoundId) {
      toast.error("Please select a consultation round");
      return;
    }

    setIsGenerating(true);
    try {
      await generateRoundReportWithTemplate(selectedRoundId, selectedTemplateId);

      // Invalidate both the report list and the selected round detail cache
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["report_artifacts"] }),
        queryClient.invalidateQueries({
          queryKey: ["consultation_rounds", selectedRoundId, "detail"],
        }),
      ]);

      toast.success("Report generated successfully");
      posthog.capture("report_generated", {
        source: "reports_page",
        round_id: selectedRoundId,
        artifact_type: "report",
      });

      // Reset round selector to encourage sequential generation if desired
      setSelectedRoundId("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate report"
      );
    } finally {
      setIsGenerating(false);
    }
  }, [selectedRoundId, selectedTemplateId, queryClient]);

  const activeTemplates = templates.filter((t) => t.is_active);
  const hasTemplates = activeTemplates.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Generate Report</CardTitle>
        <CardDescription>
          Select a consultation round and template, then generate a report to add to your library.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Round Selector */}
          <div className="space-y-2">
            <label htmlFor="round-select" className="text-sm font-medium">
              Consultation Round
            </label>
            <Select value={selectedRoundId} onValueChange={setSelectedRoundId}>
              <SelectTrigger id="round-select" className="h-9">
                <SelectValue placeholder="Choose a round..." />
              </SelectTrigger>
              <SelectContent>
                {rounds.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No consultation rounds available
                  </div>
                ) : (
                  rounds.map((round: Consultation) => (
                    <SelectItem key={round.id} value={round.id}>
                      {round.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Template Selector */}
          {hasTemplates ? (
            <div className="space-y-2">
              <label htmlFor="template-select" className="text-sm font-medium">
                Report Template
              </label>
              <Select
                value={selectedTemplateId ?? "__none__"}
                onValueChange={(val) =>
                  setSelectedTemplateId(val === "__none__" ? null : val)
                }
              >
                <SelectTrigger id="template-select" className="h-9">
                  <SelectValue placeholder="No template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-sm">
                    No template
                  </SelectItem>
                  {activeTemplates.map((t: ReportTemplate) => (
                    <SelectItem key={t.id} value={t.id} className="text-sm">
                      {t.name}
                      {t.is_default ? " (default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={!selectedRoundId || isGenerating}
          className="w-full sm:w-auto"
        >
          {isGenerating ? "Generating..." : "Generate Report"}
        </Button>

        {/* Empty state hint */}
        {rounds.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Create consultation rounds to start generating reports.
          </p>
        )}
        {rounds.length > 0 && !hasTemplates && (
          <p className="text-xs text-muted-foreground">
            Create or activate a report template in Settings to generate reports with formatting.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { use, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoundDetail } from "@/hooks/use-round-detail";
import { RoundDetailHeader } from "@/components/consultations/rounds/round-detail-header";
import { LinkedConsultationsSection } from "@/components/consultations/rounds/linked-consultations-section";
import { ThemeGroupingWorkspace } from "@/components/consultations/rounds/theme-grouping-workspace";
import { RoundOutputsSection } from "@/components/consultations/rounds/round-outputs-section";
import { DecisionHistorySection } from "@/components/consultations/rounds/decision-history-section";
import { AnalyticsPlaceholder } from "@/components/consultations/rounds/analytics-placeholder";
import {
  generateRoundSummary,
  generateRoundReport,
  generateRoundEmail,
} from "@/lib/actions/round-detail";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h2>
  );
}

export default function RoundDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading, error } = useRoundDetail(id);

  const handleStructuralChange = useCallback(() => {
    // Structural grouping changes trigger a draft AI refinement.
    // In production this would call the AI service; for now we log it.
    toast.info("Structural change detected — AI refinement will be triggered when available.");
  }, []);

  const handleGenerateSummary = useCallback(
    async (roundId: string) => {
      try {
        await generateRoundSummary(roundId);
        toast.success("Summary generation requested");
      } catch (err) {
        toast.error("Failed to generate summary");
      }
    },
    []
  );

  const handleGenerateReport = useCallback(
    async (roundId: string) => {
      try {
        await generateRoundReport(roundId);
        toast.success("Report generation requested");
      } catch (err) {
        toast.error("Failed to generate report");
      }
    },
    []
  );

  const handleGenerateEmail = useCallback(
    async (roundId: string) => {
      try {
        await generateRoundEmail(roundId);
        toast.success("Email generation requested");
      } catch (err) {
        toast.error("Failed to generate email");
      }
    },
    []
  );

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // ─── Error ─────────────────────────────────────────────────────────────────

  if (error || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-2">
        <p className="text-sm text-destructive">
          Failed to load round. It may not exist or you may not have access.
        </p>
        <Button variant="ghost" asChild>
          <Link href="/consultations/rounds">Back to rounds</Link>
        </Button>
      </div>
    );
  }

  // ─── Page ──────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <RoundDetailHeader round={data.round} />

      <Separator />

      {/* Linked Consultations */}
      <section className="space-y-3">
        <SectionHeading>Linked Consultations</SectionHeading>
        <LinkedConsultationsSection consultations={data.consultations} />
      </section>

      <Separator />

      {/* Theme Grouping Workspace — the primary synthesis canvas */}
      <section className="space-y-3">
        <SectionHeading>Theme Grouping</SectionHeading>
        <ThemeGroupingWorkspace
          roundId={id}
          sourceThemes={data.sourceThemes}
          initialGroups={data.themeGroups}
          onStructuralChange={handleStructuralChange}
        />
      </section>

      <Separator />

      {/* Round Outputs */}
      <section className="space-y-3">
        <SectionHeading>Outputs</SectionHeading>
        <RoundOutputsSection
          roundId={id}
          outputs={data.outputs}
          onGenerateSummary={handleGenerateSummary}
          onGenerateReport={handleGenerateReport}
          onGenerateEmail={handleGenerateEmail}
        />
      </section>

      <Separator />

      {/* Decision History */}
      <section className="space-y-3">
        <SectionHeading>Audit &amp; History</SectionHeading>
        <DecisionHistorySection decisions={data.decisionHistory} />
      </section>

      <Separator />

      {/* Analytics Placeholder */}
      <section className="space-y-3">
        <SectionHeading>Analytics</SectionHeading>
        <AnalyticsPlaceholder />
      </section>
    </div>
  );
}

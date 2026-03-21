"use client";

import { use, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoundDetail } from "@/hooks/use-rounds";
import { RoundDetailHeader } from "@/components/consultations/rounds/round-detail-header";
import { LinkedConsultationsSection } from "@/components/consultations/rounds/linked-consultations-section";
import { ThemeGroupingWorkspace } from "@/components/consultations/rounds/theme-grouping-workspace";
import { RoundOutputsSection } from "@/components/consultations/rounds/round-outputs-section";
import { DecisionHistorySection } from "@/components/consultations/rounds/decision-history-section";
import { AnalyticsPanel } from "@/components/consultations/rounds/analytics-panel";
import { RoundAuditTrail } from "@/components/audit/audit-trail";
import type { SourceTheme, RoundThemeGroup, RoundConsultationSummary } from "@/types/round-detail";
import {
  generateRoundSummary,
  generateRoundReport,
  generateRoundEmail,
} from "@/lib/actions/round-workflow";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

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
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useRoundDetail(id);

  // Adapt Agent 1 types to component-friendly shapes
  const adaptedSourceThemes: SourceTheme[] = data?.sourceThemes
    ? data.sourceThemes.map((theme) => ({
        id: theme.sourceThemeId,
        sourceConsultationId: theme.consultationId,
        sourceConsultationTitle: theme.consultationTitle,
        label: theme.label,
        description: theme.description,
        editableLabel: theme.editableLabel,
        editableDescription: theme.editableDescription,
        lockedFromSource: theme.lockedFromSource,
        isGrouped: theme.isGrouped,
        isUserAdded: theme.isUserAdded,
        groupId: theme.groupId,
      }))
    : [];

  const adaptedConsultations: RoundConsultationSummary[] = data?.consultations
    ? (() => {
        const themeCountMap = new Map<string, number>();
      for (const theme of data.sourceThemes ?? []) {
          themeCountMap.set(
            theme.consultationId,
            (themeCountMap.get(theme.consultationId) || 0) + 1
          );
        }
      return data.consultations.map((consultation) => ({
        id: consultation.id,
        title: consultation.title,
        status: consultation.status,
        evidenceEmailSubject: consultation.evidenceEmail?.subject ?? null,
        evidenceEmailStatus: consultation.evidenceEmail?.status ?? null,
        themeCount: themeCountMap.get(consultation.id) ?? 0,
        groupId: null,
      }));
    })()
    : [];

  const adaptedThemeGroups: RoundThemeGroup[] = data?.themeGroups ?? [];

  const handleStructuralChange = useCallback(() => {
    toast.info("Structural change detected — AI refinement will be triggered when available.");
  }, []);

  const handleGenerateSummary = useCallback(
    async (roundId: string) => {
      try {
        await generateRoundSummary(roundId);
        await queryClient.invalidateQueries({ queryKey: ["consultation_rounds", roundId, "detail"] });
        toast.success("Summary generated");
      } catch (error) {
        console.error("[rounds.page] failed to generate summary", {
          roundId,
          error,
        });
        toast.error(getErrorMessage(error, "Failed to generate summary"));
      }
    },
    [queryClient]
  );

  const handleGenerateReport = useCallback(
    async (roundId: string) => {
      try {
        await generateRoundReport(roundId);
        await queryClient.invalidateQueries({ queryKey: ["consultation_rounds", roundId, "detail"] });
        toast.success("Report generated");
      } catch (error) {
        console.error("[rounds.page] failed to generate report", {
          roundId,
          error,
        });
        toast.error(getErrorMessage(error, "Failed to generate report"));
      }
    },
    [queryClient]
  );

  const handleGenerateEmail = useCallback(
    async (roundId: string) => {
      try {
        await generateRoundEmail(roundId);
        await queryClient.invalidateQueries({ queryKey: ["consultation_rounds", roundId, "detail"] });
        toast.success("Email generated");
      } catch (error) {
        console.error("[rounds.page] failed to generate email", {
          roundId,
          error,
        });
        toast.error(getErrorMessage(error, "Failed to generate email"));
      }
    },
    [queryClient]
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
      <div className="flex items-start justify-between gap-4">
        <RoundDetailHeader round={data.round} />
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link href={`/canvas/round/${id}`}>Evidence canvas →</Link>
        </Button>
      </div>

      <Separator />

      {/* Linked Consultations */}
      <section className="space-y-3">
        <SectionHeading>Linked Consultations</SectionHeading>
        <LinkedConsultationsSection consultations={adaptedConsultations} />
      </section>

      <Separator />

      {/* Analytics */}
      <section className="space-y-3">
        <SectionHeading>Analytics</SectionHeading>
        <AnalyticsPanel
          roundId={id}
          roundLabel={data.round.label}
          consultations={data.consultations}
          analytics={data.analytics}
          decisionHistory={data.decisionHistory}
        />
      </section>

      <Separator />

      {/* Theme Grouping Workspace — the primary synthesis canvas */}
      <section className="space-y-3">
        <SectionHeading>Theme Grouping</SectionHeading>
        <ThemeGroupingWorkspace
          roundId={id}
          roundLabel={data.round.label}
          sourceThemes={adaptedSourceThemes}
          initialGroups={adaptedThemeGroups}
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
        <SectionHeading>Decision History</SectionHeading>
        <DecisionHistorySection decisions={data.decisionHistory} />
      </section>

      <Separator />

      {/* Audit Trail */}
      <section className="space-y-3">
        <SectionHeading>Audit Trail</SectionHeading>
        <RoundAuditTrail roundId={id} />
      </section>
    </div>
  );
}

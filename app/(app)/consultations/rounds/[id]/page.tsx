"use client";

import { use, useCallback } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RoundAuditTrail } from "@/components/audit/audit-trail";
import { AnalyticsPanel } from "@/components/consultations/rounds/analytics-panel";
import { DecisionHistorySection } from "@/components/consultations/rounds/decision-history-section";
import { LinkedConsultationsSection } from "@/components/consultations/rounds/linked-consultations-section";
import { RoundDetailHeader } from "@/components/consultations/rounds/round-detail-header";
import { RoundOutputsSection } from "@/components/consultations/rounds/round-outputs-section";
import { ThemeGroupingWorkspace } from "@/components/consultations/rounds/theme-grouping-workspace";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoundDetail } from "@/hooks/use-consultations";
import {
  generateRoundEmail,
  generateRoundReport,
  generateRoundSummary,
} from "@/lib/actions/consultation-workflow";
import type { RoundConsultationSummary, SourceTheme } from "@/types/round-detail";

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

  const adaptedSourceThemes: SourceTheme[] = (data?.sourceThemes ?? []).map((theme) => ({
    id: theme.sourceThemeId,
    sourceMeetingId: theme.consultationId,
    sourceMeetingTitle: theme.consultationTitle,
    sourceMeetingIds: [theme.consultationId],
    sourceMeetingTitles: [theme.consultationTitle],
    label: theme.label,
    description: theme.description,
    editableLabel: theme.editableLabel,
    editableDescription: theme.editableDescription,
    lockedFromSource: theme.lockedFromSource,
    isGrouped: theme.isGrouped,
    isUserAdded: theme.isUserAdded,
    groupId: theme.groupId,
  }));

  const adaptedMeetings: RoundConsultationSummary[] = data?.consultations
    ? (() => {
        const themeCountByMeetingId = new Map<string, number>();

        for (const theme of data.sourceThemes) {
          themeCountByMeetingId.set(
            theme.consultationId,
            (themeCountByMeetingId.get(theme.consultationId) ?? 0) + 1
          );
        }

        return data.consultations.map((meeting) => ({
          id: meeting.id,
          title: meeting.title,
          status: meeting.status,
          evidenceEmailSubject: meeting.evidenceEmail?.subject ?? null,
          evidenceEmailStatus: meeting.evidenceEmail?.status ?? null,
          themeCount: themeCountByMeetingId.get(meeting.id) ?? 0,
          groupId: null,
        }));
      })()
    : [];

  const invalidateRoundDetail = useCallback(
    async (roundId: string) => {
      await queryClient.invalidateQueries({
        queryKey: ["consultation_rounds", roundId, "detail"],
      });
    },
    [queryClient]
  );

  const handleStructuralChange = useCallback(() => {
    toast.info("Theme grouping updated.");
  }, []);

  const handleGenerateSummary = useCallback(
    async (roundId: string) => {
      try {
        await generateRoundSummary(roundId);
        await invalidateRoundDetail(roundId);
        toast.success("Summary generated");
      } catch {
        toast.error("Failed to generate summary");
      }
    },
    [invalidateRoundDetail]
  );

  const handleGenerateReport = useCallback(
    async (roundId: string) => {
      try {
        await generateRoundReport(roundId);
        await invalidateRoundDetail(roundId);
        toast.success("Report generated");
      } catch {
        toast.error("Failed to generate report");
      }
    },
    [invalidateRoundDetail]
  );

  const handleGenerateEmail = useCallback(
    async (roundId: string) => {
      try {
        await generateRoundEmail(roundId);
        await invalidateRoundDetail(roundId);
        toast.success("Email generated");
      } catch {
        toast.error("Failed to generate email");
      }
    },
    [invalidateRoundDetail]
  );

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

  if (error || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-2">
        <p className="text-sm text-destructive">
          Failed to load round. It may not exist or you may not have access.
        </p>
        <Button variant="ghost" asChild>
          <Link href="/consultations">Back to rounds</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <RoundDetailHeader round={data.round} />

      <Separator />

      <section className="space-y-3">
        <SectionHeading>Linked Meetings</SectionHeading>
        <LinkedConsultationsSection meetings={adaptedMeetings} />
      </section>

      <Separator />

      <section className="space-y-3">
        <SectionHeading>Reports</SectionHeading>
        <RoundOutputsSection
          roundId={id}
          outputs={data.outputs}
          onGenerateSummary={handleGenerateSummary}
          onGenerateReport={handleGenerateReport}
          onGenerateEmail={handleGenerateEmail}
        />
      </section>

      <Separator />

      <section className="space-y-3">
        <SectionHeading>Analysis</SectionHeading>
        <AnalyticsPanel
          consultationGroupId={id}
          meetings={data.consultations}
          analytics={data.analytics}
          decisionHistory={data.decisionHistory}
        />
      </section>

      <Separator />

      <section className="space-y-3">
        <SectionHeading>Groupings</SectionHeading>
        <ThemeGroupingWorkspace
          roundId={id}
          roundLabel={data.round.label}
          sourceThemes={adaptedSourceThemes}
          initialGroups={data.themeGroups}
          onStructuralChange={handleStructuralChange}
        />
      </section>

      <Separator />

      <section className="space-y-3">
        <SectionHeading>Decision Logs</SectionHeading>
        <DecisionHistorySection decisions={data.decisionHistory} />
      </section>

      <Separator />

      <section className="space-y-3">
        <SectionHeading>Audit</SectionHeading>
        <RoundAuditTrail roundId={id} />
      </section>
    </div>
  );
}

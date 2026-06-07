"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import posthog from "posthog-js";
import { CanvasShell, type CanvasShellHandle } from "@/components/canvas/canvas-shell";
import { GridShell } from "@/components/grid/grid-shell";
import { RoundAuditTrail } from "@/components/audit/audit-trail";
import { AnalyticsPanel } from "@/components/consultations/rounds/analytics-panel";
import { LinkedConsultationsSection } from "@/components/consultations/rounds/linked-consultations-section";
import { RoundOutputsSection } from "@/components/consultations/rounds/round-outputs-section";
import { ThemeGroupingWorkspace } from "@/components/consultations/rounds/theme-grouping-workspace";
import { cn } from "@/lib/utils";
import { useRoundDetail } from "@/hooks/use-consultations";
import { useReportTemplates } from "@/hooks/use-report-templates";
import {
  generateRoundEmail,
  generateRoundReportWithTemplate,
  generateRoundSummary,
} from "@/lib/actions/consultation-workflow";
import type { RoundConsultationSummary, SourceTheme } from "@/types/round-detail";

const VALID_TABS = ["canvas", "meetings", "grid", "analysis", "reports", "audit"] as const;
type Tab = (typeof VALID_TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  canvas: "Canvas",
  meetings: "Meetings",
  grid: "Grid",
  reports: "Reports",
  analysis: "Analysis",
  audit: "Audit",
};

interface CanvasWorkspaceShellProps {
  roundId: string;
  roundLabel: string;
}

export function CanvasWorkspaceShell({ roundId, roundLabel }: CanvasWorkspaceShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const rawTab = searchParams.get("tab");
  const activeTab: Tab = VALID_TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "canvas";
  const [previousTab, setPreviousTab] = useState<Tab>(activeTab);

  const canvasRef = useRef<CanvasShellHandle>(null);

  const [everActivated, setEverActivated] = useState<Record<Tab, boolean>>({
    canvas: true,
    meetings: false,
    grid: false,
    reports: false,
    analysis: false,
    audit: false,
  });

  useEffect(() => {
    setEverActivated((prev) => {
      if (prev[activeTab]) return prev;
      return { ...prev, [activeTab]: true };
    });
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "canvas" && previousTab !== "canvas") {
      requestAnimationFrame(() => canvasRef.current?.fitView({ duration: 200 }));
    }
    setPreviousTab(activeTab);
  }, [activeTab, previousTab]);

  function handleTabChange(tab: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    posthog.capture("canvas_tab_switched", { roundId, fromTab: activeTab, toTab: tab });
    router.replace(`?${params.toString()}`);
  }

  const { data } = useRoundDetail(roundId);
  const { data: templates = [] } = useReportTemplates();

  const invalidateRoundDetail = useCallback(
    async (id: string) => {
      await queryClient.invalidateQueries({
        queryKey: ["consultation_rounds", id, "detail"],
      });
    },
    [queryClient]
  );

  const handleStructuralChange = useCallback(() => {
    toast.info("Theme grouping updated.");
  }, []);

  const handleGenerateSummary = useCallback(
    async (id: string) => {
      try {
        await generateRoundSummary(id);
        await invalidateRoundDetail(id);
        toast.success("Summary generated");
        posthog.capture("report_generated", { round_id: id, artifact_type: "summary" });
      } catch {
        toast.error("Failed to generate summary");
      }
    },
    [invalidateRoundDetail]
  );

  const handleGenerateReport = useCallback(
    async (id: string, templateId: string | null) => {
      try {
        await generateRoundReportWithTemplate(id, templateId);
        await invalidateRoundDetail(id);
        toast.success("Report generated");
        posthog.capture("report_generated", { round_id: id, artifact_type: "report" });
      } catch {
        toast.error("Failed to generate report");
      }
    },
    [invalidateRoundDetail]
  );

  const handleGenerateEmail = useCallback(
    async (id: string) => {
      try {
        await generateRoundEmail(id);
        await invalidateRoundDetail(id);
        toast.success("Email generated");
        posthog.capture("report_generated", { round_id: id, artifact_type: "email" });
      } catch {
        toast.error("Failed to generate email");
      }
    },
    [invalidateRoundDetail]
  );

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

  return (
    <div className="-mx-4 -my-5 flex h-[calc(100vh-3rem)] flex-col overflow-hidden sm:-mx-6">
      <header className="flex shrink-0 flex-col border-b">
        <div className="flex items-center gap-2 px-4 py-2">
          <Link href="/consultations" className="text-sm text-muted-foreground hover:text-foreground">
            Consultations
          </Link>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-medium">{roundLabel}</span>
        </div>
        <nav className="flex px-2" aria-label="Canvas workspace tabs">
          {VALID_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              aria-current={activeTab === tab ? "page" : undefined}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors",
                activeTab === tab
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </nav>
      </header>

      <div className="relative flex-1 overflow-hidden">
        {/* Canvas tab — always mounted, hidden via CSS visibility to preserve React Flow state */}
        <div
          style={{
            opacity: activeTab === "canvas" ? 1 : 0,
            pointerEvents: activeTab === "canvas" ? "auto" : "none",
            position: "absolute",
            inset: 0,
          }}
          aria-hidden={activeTab !== "canvas"}
          inert={activeTab !== "canvas"}
        >
          <CanvasShell ref={canvasRef} roundId={roundId} />
        </div>

        {everActivated.meetings && (
          <div hidden={activeTab !== "meetings"} className="h-full overflow-y-auto">
            <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
              <LinkedConsultationsSection meetings={adaptedMeetings} />
            </div>
          </div>
        )}

        {everActivated.grid && (
          <div hidden={activeTab !== "grid"} className="h-full">
            <GridShell
              roundId={roundId}
              meetings={(data?.consultations ?? []).map((meeting) => ({
                id: meeting.id,
                title: meeting.title,
              }))}
            />
          </div>
        )}

        {everActivated.reports && (
          <div hidden={activeTab !== "reports"} className="h-full overflow-y-auto">
            <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
              {data && (
                <RoundOutputsSection
                  roundId={roundId}
                  outputs={data.outputs}
                  templates={templates}
                  onGenerateSummary={handleGenerateSummary}
                  onGenerateReport={handleGenerateReport}
                  onGenerateEmail={handleGenerateEmail}
                />
              )}
            </div>
          </div>
        )}

        {everActivated.analysis && (
          <div hidden={activeTab !== "analysis"} className="h-full overflow-y-auto">
            <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
              {data && (
                <>
                  <AnalyticsPanel
                    consultationGroupId={roundId}
                    meetings={data.consultations}
                    analytics={data.analytics}
                    decisionHistory={data.decisionHistory}
                  />
                  <ThemeGroupingWorkspace
                    roundId={roundId}
                    roundLabel={data.round.label}
                    sourceThemes={adaptedSourceThemes}
                    initialGroups={data.themeGroups}
                    onStructuralChange={handleStructuralChange}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {everActivated.audit && (
          <div hidden={activeTab !== "audit"} className="h-full overflow-y-auto">
            <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
              <RoundAuditTrail roundId={roundId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

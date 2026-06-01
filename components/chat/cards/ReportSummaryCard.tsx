"use client";

import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import { readReportSummaryOutput } from "@/lib/chat/tools/report-show";
import type { ChatCardProps } from "./types";

export function ReportSummaryCard({ tool }: ChatCardProps) {
  const data = useMemo(() => readReportSummaryOutput(tool.output), [tool.output]);

  if (tool.status === "error") {
    return (
      <ChatToolCardShell
        title="Report"
        description="Could not load report"
        error="Couldn't load this report. Refresh or check your connection."
      />
    );
  }

  const output = tool.output as Record<string, unknown> | null;
  const noReport = output && typeof output === "object" && "no_report" in output;

  if (noReport) {
    const meetingName = typeof output?.meeting_name === "string" ? output.meeting_name : "this meeting";
    return (
      <ChatToolCardShell
        title="Report"
        description={`No report yet for ${meetingName}. Say 'generate report' when you're ready.`}
      />
    );
  }

  if (!data) {
    return (
      <ChatToolCardShell
        title="Report"
        description="No report yet for this meeting. Say 'generate report' when you're ready."
      />
    );
  }

  const reportUrl = `/reports/${data.report_id}`;
  const formattedDate = (() => {
    try {
      return new Date(data.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return data.created_at;
    }
  })();

  return (
    <ChatToolCardShell
      title={data.title}
      description={`${data.meeting_name} · ${formattedDate}`}
      footer={
        <Button variant="outline" size="sm" asChild>
          <a href={reportUrl} target="_blank" rel="noreferrer">
            Open full report <ExternalLink className="ml-1.5 size-3.5" />
          </a>
        </Button>
      }
    />
  );
}

"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCardConfirm } from "@/components/chat/card-confirm-context";
import { readReportExportOutput } from "@/lib/chat/tools/report-export";
import { ChatToolCardShell } from "./chat-tool-card-shell";
import type { ChatCardProps } from "./types";

type ExportFormat = "pdf" | "docx" | "markdown";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  pdf: "PDF",
  docx: "Word (.docx)",
  markdown: "Markdown (.md)",
};

export function ReportExportCard({ tool, messageId, sessionId, onUpdated }: ChatCardProps) {
  const data = useMemo(() => readReportExportOutput(tool.output), [tool.output]);
  const output = tool.output as Record<string, unknown> | null;
  const noReport = output && "no_report" in output;

  const { isPending, setPending } = useCardConfirm();
  const confirmKey = `export-report:${messageId}`;
  const confirming = isPending(confirmKey);

  const [format, setFormat] = useState<ExportFormat>(data?.format ?? "docx");
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  if (noReport) {
    const title = typeof output?.consultation_title === "string" ? output.consultation_title : "this meeting";
    return (
      <ChatToolCardShell
        title="Export report"
        description={`${title} doesn't have a report yet. Generate one first, then export.`}
      />
    );
  }

  if (tool.status === "error") {
    return (
      <ChatToolCardShell
        title="Export report"
        description="Export failed"
        error={`Export failed. Try again or download from the reports page.`}
      />
    );
  }

  if (!data) return null;

  if (completed || tool.status === "success") {
    return (
      <ChatToolCardShell
        success
        title="Export started"
        description={`${data.consultation_title} — ${FORMAT_LABELS[format]} download triggered.`}
      />
    );
  }

  async function handleExport() {
    if (!data || !sessionId) return;
    setPending(confirmKey, true);
    setError(null);

    const endpoint =
      format === "docx"
        ? `/api/reports/${data.report_id}/export/docx`
        : format === "markdown"
          ? `/api/reports/${data.report_id}/export/markdown`
          : null;

    if (!endpoint) {
      setError("PDF export is not available in this version.");
      setPending(confirmKey, false);
      return;
    }

    try {
      const response = await fetch(endpoint, {
        headers: { "x-chat-session-id": sessionId },
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const ext = format === "markdown" ? "md" : format;
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.consultation_title.replace(/\s+/g, "-")}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setCompleted(true);
      onUpdated?.();
    } catch (err) {
      setError(
        `Export failed — ${err instanceof Error ? err.message : "unknown error"}. Try again or download from the reports page.`
      );
    } finally {
      setPending(confirmKey, false);
    }
  }

  return (
    <ChatToolCardShell
      title="Export report"
      description={data.consultation_title}
      error={error}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={confirming}
            onClick={handleExport}
          >
            {confirming ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
            Download
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Format</Label>
        <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["docx", "markdown", "pdf"] as ExportFormat[]).map((f) => (
              <SelectItem key={f} value={f}>
                {FORMAT_LABELS[f]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </ChatToolCardShell>
  );
}

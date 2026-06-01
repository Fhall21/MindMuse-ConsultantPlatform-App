import { z } from "zod";

export const exportReportSchema = z.object({
  consultation_id: z.string().uuid().optional(),
  meeting_id: z.string().uuid().optional(),
  format: z.enum(["pdf", "docx", "markdown"]).default("docx"),
});

export interface ReportExportOutput {
  report_id: string;
  consultation_title: string;
  format: "pdf" | "docx" | "markdown";
}

export function readReportExportOutput(output: unknown): ReportExportOutput | null {
  if (!output || typeof output !== "object") return null;
  const r = output as Record<string, unknown>;
  if (typeof r.report_id !== "string" || typeof r.consultation_title !== "string") return null;
  const fmt = r.format;
  if (fmt !== "pdf" && fmt !== "docx" && fmt !== "markdown") return null;
  return { report_id: r.report_id, consultation_title: r.consultation_title, format: fmt };
}

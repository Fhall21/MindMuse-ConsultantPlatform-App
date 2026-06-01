import { z } from "zod";

export const showReportSchema = z.object({
  consultation_id: z.string().uuid().optional(),
  meeting_id: z.string().uuid().optional(),
});

export interface ReportSummaryOutput {
  report_id: string;
  title: string;
  meeting_name: string;
  created_at: string;
  consultation_id: string;
}

export function readReportSummaryOutput(output: unknown): ReportSummaryOutput | null {
  if (!output || typeof output !== "object") return null;
  const r = output as Record<string, unknown>;
  if (
    typeof r.report_id !== "string" ||
    typeof r.title !== "string" ||
    typeof r.meeting_name !== "string" ||
    typeof r.created_at !== "string" ||
    typeof r.consultation_id !== "string"
  ) {
    return null;
  }
  return {
    report_id: r.report_id,
    title: r.title,
    meeting_name: r.meeting_name,
    created_at: r.created_at,
    consultation_id: r.consultation_id,
  };
}

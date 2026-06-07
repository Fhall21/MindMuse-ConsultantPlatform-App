import { z } from "zod";

export const startCrossAnalysisSchema = z.object({
  consultation_id: z.string().uuid(),
});

export const listPreviousAnalysesSchema = z.object({
  consultation_id: z.string().uuid(),
});

export interface AnalysisJobSummary {
  id: string;
  task_id: string;
  pattern_count: number;
  transcript_count: number;
  created_at: string;
}

export function readAnalysisJobSummaryList(output: unknown): AnalysisJobSummary[] {
  if (!Array.isArray(output)) return [];
  return output.filter(
    (item): item is AnalysisJobSummary =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as Record<string, unknown>).id === "string"
  );
}

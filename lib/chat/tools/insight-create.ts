import { z } from "zod";

export const createInsightSchema = z.object({
  meeting_id: z.string().uuid().optional(),
  consultation_id: z.string().uuid().optional(),
  label_hint: z.string().optional(),
});

export interface InsightCreateOutput {
  meeting_id: string;
  label_hint: string;
}

export function readInsightCreateOutput(output: unknown): InsightCreateOutput | null {
  if (!output || typeof output !== "object") return null;
  const r = output as Record<string, unknown>;
  if (typeof r.meeting_id !== "string") return null;
  return {
    meeting_id: r.meeting_id,
    label_hint: typeof r.label_hint === "string" ? r.label_hint : "",
  };
}

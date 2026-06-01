import { z } from "zod";

export const editThemeSchema = z.object({
  insight_id: z.string().uuid().optional(),
  meeting_id: z.string().uuid().optional(),
  consultation_id: z.string().uuid().optional(),
  label_hint: z.string().optional(),
});

export interface ThemeEditOutput {
  insight_id: string;
  label: string;
  description: string | null;
}

export function readThemeEditOutput(output: unknown): ThemeEditOutput | null {
  if (!output || typeof output !== "object") return null;
  const r = output as Record<string, unknown>;
  if (typeof r.insight_id !== "string" || typeof r.label !== "string") return null;
  return {
    insight_id: r.insight_id,
    label: r.label,
    description: typeof r.description === "string" ? r.description : null,
  };
}

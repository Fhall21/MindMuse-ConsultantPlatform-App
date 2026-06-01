import { z } from "zod";

export const linkPersonToConsultationSchema = z.object({
  meeting_id: z.string().uuid().optional(),
  consultation_id: z.string().uuid().optional(),
  person_name_hint: z.string().optional(),
});

export interface PersonLinkOutput {
  people: Array<{ id: string; name: string }>;
  meeting_id: string;
}

export function readPersonLinkOutput(output: unknown): PersonLinkOutput | null {
  if (!output || typeof output !== "object") return null;
  const r = output as Record<string, unknown>;
  if (typeof r.meeting_id !== "string") return null;
  if (!Array.isArray(r.people)) return null;
  return {
    meeting_id: r.meeting_id,
    people: r.people.filter(
      (p): p is { id: string; name: string } =>
        Boolean(p) &&
        typeof (p as Record<string, unknown>).id === "string" &&
        typeof (p as Record<string, unknown>).name === "string"
    ),
  };
}

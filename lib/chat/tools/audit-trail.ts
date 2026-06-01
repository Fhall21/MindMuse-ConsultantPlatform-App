import { z } from "zod";

export const showAuditTrailSchema = z.object({
  consultation_id: z.string().uuid().optional(),
  meeting_id: z.string().uuid().optional(),
  filter: z.enum(["this_meeting", "all"]).default("all"),
});

export interface AuditEventItem {
  id: string;
  action: string;
  actor_id: string;
  created_at: string;
  entity_type: string | null;
  entity_id: string | null;
}

export interface AuditTrailOutput {
  consultation_id: string;
  events: AuditEventItem[];
}

export function readAuditTrailOutput(output: unknown): AuditTrailOutput | null {
  if (!output || typeof output !== "object") return null;
  const r = output as Record<string, unknown>;
  if (typeof r.consultation_id !== "string") return null;
  if (!Array.isArray(r.events)) return null;
  return {
    consultation_id: r.consultation_id,
    events: r.events.filter(
      (e): e is AuditEventItem =>
        Boolean(e) &&
        typeof (e as Record<string, unknown>).id === "string" &&
        typeof (e as Record<string, unknown>).action === "string"
    ),
  };
}

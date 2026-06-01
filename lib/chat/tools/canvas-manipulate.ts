import { z } from "zod";

export const manipulateCanvasSchema = z.object({
  operation: z.enum(["connect", "rename"]),
  consultation_id: z.string().uuid().optional(),
  // connect
  source_node_id: z.string().optional(),
  source_node_label: z.string().optional(),
  source_node_type: z.enum(["theme", "insight"]).optional(),
  target_node_id: z.string().optional(),
  target_node_label: z.string().optional(),
  target_node_type: z.enum(["theme", "insight"]).optional(),
  connection_type: z.string().default("related_to"),
  // rename
  node_id: z.string().optional(),
  node_label: z.string().optional(),
  new_label: z.string().optional(),
  is_frame: z.boolean().default(false),
});

export interface CanvasOperationProposal {
  operation: "connect" | "rename";
  consultation_id: string;
  // connect
  source_node_id?: string;
  source_node_label?: string;
  source_node_type?: "theme" | "insight";
  target_node_id?: string;
  target_node_label?: string;
  target_node_type?: "theme" | "insight";
  connection_type?: string;
  // rename
  node_id?: string;
  node_label?: string;
  new_label?: string;
  is_frame?: boolean;
}

export function readCanvasOperationProposal(output: unknown): CanvasOperationProposal | null {
  if (!output || typeof output !== "object") return null;
  const r = output as Record<string, unknown>;
  if (r.operation !== "connect" && r.operation !== "rename") return null;
  if (typeof r.consultation_id !== "string") return null;
  return {
    operation: r.operation,
    consultation_id: r.consultation_id,
    source_node_id: typeof r.source_node_id === "string" ? r.source_node_id : undefined,
    source_node_label:
      typeof r.source_node_label === "string" ? r.source_node_label : undefined,
    source_node_type:
      r.source_node_type === "theme" || r.source_node_type === "insight"
        ? r.source_node_type
        : undefined,
    target_node_id: typeof r.target_node_id === "string" ? r.target_node_id : undefined,
    target_node_label:
      typeof r.target_node_label === "string" ? r.target_node_label : undefined,
    target_node_type:
      r.target_node_type === "theme" || r.target_node_type === "insight"
        ? r.target_node_type
        : undefined,
    connection_type:
      typeof r.connection_type === "string" ? r.connection_type : "related_to",
    node_id: typeof r.node_id === "string" ? r.node_id : undefined,
    node_label: typeof r.node_label === "string" ? r.node_label : undefined,
    new_label: typeof r.new_label === "string" ? r.new_label : undefined,
    is_frame: r.is_frame === true,
  };
}

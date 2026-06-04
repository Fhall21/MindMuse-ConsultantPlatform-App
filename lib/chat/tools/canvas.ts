import { z } from "zod";
import type { CanvasEdge, CanvasNode, CanvasNodeType, ConnectionType } from "@/types/canvas";

export const previewCanvasSchema = z.object({
  consultation_id: z.string().uuid(),
  /** Ephemeral preview-only layout; does not persist to the canvas. */
  layout_action: z.enum(["arrange"]).optional(),
});

export interface CanvasLayoutPreview {
  consultation_id: string;
  canvas_nodes: CanvasNode[];
  canvas_edges: CanvasEdge[];
  node_count: number;
  group_count: number;
}

const CONNECTION_TYPES: ConnectionType[] = [
  "causes",
  "influences",
  "supports",
  "contradicts",
  "context",
  "related_to",
];

function parseCanvasNode(item: unknown): CanvasNode | null {
  if (!item || typeof item !== "object") return null;
  const node = item as Record<string, unknown>;
  const type = node.type;
  if (type !== "theme" && type !== "insight") return null;
  if (typeof node.id !== "string" || typeof node.label !== "string") return null;

  const position =
    node.position &&
    typeof node.position === "object" &&
    typeof (node.position as { x?: unknown }).x === "number" &&
    typeof (node.position as { y?: unknown }).y === "number"
      ? {
          x: (node.position as { x: number }).x,
          y: (node.position as { y: number }).y,
        }
      : typeof node.x === "number" && typeof node.y === "number"
        ? { x: node.x, y: node.y }
        : null;

  if (!position) return null;

  const memberIds = Array.isArray(node.memberIds)
    ? node.memberIds.filter((id): id is string => typeof id === "string")
    : [];

  return {
    id: node.id,
    type: type as CanvasNodeType,
    label: node.label,
    description: typeof node.description === "string" ? node.description : null,
    accepted: node.accepted !== false,
    subgroup: typeof node.subgroup === "string" ? node.subgroup : null,
    sourceConsultationId:
      typeof node.sourceConsultationId === "string" ? node.sourceConsultationId : null,
    sourceConsultationTitle:
      typeof node.sourceConsultationTitle === "string" ? node.sourceConsultationTitle : null,
    sourceType:
      node.sourceType === "meeting" ||
      node.sourceType === "flow" ||
      node.sourceType === "research"
        ? node.sourceType
        : undefined,
    researchSessionId:
      typeof node.researchSessionId === "string" ? node.researchSessionId : null,
    researchReferenceLabel:
      typeof node.researchReferenceLabel === "string" ? node.researchReferenceLabel : null,
    researchQuotePreview:
      typeof node.researchQuotePreview === "string" ? node.researchQuotePreview : null,
    groupId: typeof node.groupId === "string" ? node.groupId : null,
    memberIds,
    isBrainstorming: node.isBrainstorming === true,
    isUserAdded: node.isUserAdded === true,
    lockedFromSource: node.lockedFromSource === true,
    position,
  };
}

function parseCanvasEdge(item: unknown): CanvasEdge | null {
  if (!item || typeof item !== "object") return null;
  const edge = item as Record<string, unknown>;

  const source =
    typeof edge.source_node_id === "string"
      ? edge.source_node_id
      : typeof edge.from === "string"
        ? edge.from
        : null;
  const target =
    typeof edge.target_node_id === "string"
      ? edge.target_node_id
      : typeof edge.to === "string"
        ? edge.to
        : null;

  if (!source || !target) return null;

  const connectionType = CONNECTION_TYPES.includes(edge.connection_type as ConnectionType)
    ? (edge.connection_type as ConnectionType)
    : "related_to";

  const now = new Date(0).toISOString();

  return {
    id: typeof edge.id === "string" ? edge.id : `${source}-${target}`,
    source_node_id: source,
    target_node_id: target,
    connection_type: connectionType,
    note: typeof edge.note === "string" ? edge.note : null,
    created_by: typeof edge.created_by === "string" ? edge.created_by : "preview",
    created_at: typeof edge.created_at === "string" ? edge.created_at : now,
    updated_at: typeof edge.updated_at === "string" ? edge.updated_at : now,
  };
}

export function readCanvasLayoutPreview(output: unknown): CanvasLayoutPreview | null {
  if (!output || typeof output !== "object") {
    return null;
  }

  const record = output as Record<string, unknown>;
  if (typeof record.consultation_id !== "string") {
    return null;
  }

  const rawNodes = Array.isArray(record.canvas_nodes)
    ? record.canvas_nodes
    : Array.isArray(record.nodes)
      ? record.nodes
      : null;

  if (!rawNodes) {
    return null;
  }

  const canvas_nodes = rawNodes
    .map(parseCanvasNode)
    .filter((node): node is CanvasNode => node !== null);

  const rawEdges = Array.isArray(record.canvas_edges)
    ? record.canvas_edges
    : Array.isArray(record.edges)
      ? record.edges
      : [];

  const canvas_edges = rawEdges
    .map(parseCanvasEdge)
    .filter((edge): edge is CanvasEdge => edge !== null);

  return {
    consultation_id: record.consultation_id,
    canvas_nodes,
    canvas_edges,
    node_count:
      typeof record.node_count === "number" ? record.node_count : canvas_nodes.length,
    group_count:
      typeof record.group_count === "number"
        ? record.group_count
        : canvas_nodes.filter((node) => node.type === "theme").length,
  };
}

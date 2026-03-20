/**
 * Evidence Network Canvas — shared TypeScript contracts.
 *
 * These types define the boundary between:
 *   - the Postgres + Neo4j data model (Agent 2)
 *   - the canvas UI (this agent)
 *   - the report threading layer (Agent 3)
 *
 * Keep types flat. No nested generics.
 */

// ---------------------------------------------------------------------------
// Node types
// ---------------------------------------------------------------------------

export type CanvasNodeType = "theme" | "insight";

export interface CanvasNode {
  id: string;
  type: CanvasNodeType;
  /** Display label shown in the canvas. */
  label: string;
  /** Optional short description shown below label. */
  description: string | null;
  /** Whether the theme/insight has been accepted in the round workflow. */
  accepted: boolean;
  /** Free-text subgroup tag applied by the consultant. */
  subgroup: string | null;
  /** Source consultation metadata for continuity with round grouping. */
  sourceConsultationId: string | null;
  sourceConsultationTitle: string | null;
  /** Group-membership metadata used for canvas grouping actions. */
  groupId: string | null;
  memberIds: string[];
  /** Mirrors source insight flags for card rendering. */
  isUserAdded: boolean;
  lockedFromSource: boolean;
  /** Persisted x/y position on the canvas. */
  position: CanvasPosition;
}

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface CanvasLayoutPosition extends CanvasPosition {
  nodeType: CanvasNodeType;
}

// ---------------------------------------------------------------------------
// Connection (edge) types
// ---------------------------------------------------------------------------

/**
 * Typed connection vocabulary.
 *
 * "causes"      — A is a causal factor of B
 * "influences"  — A shapes or affects B without direct causation
 * "supports"    — A provides evidence for B
 * "contradicts" — A and B are in tension
 * "related_to"  — generic / unclassified relationship
 */
export type ConnectionType =
  | "causes"
  | "influences"
  | "supports"
  | "contradicts"
  | "related_to";

export interface CanvasEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  connection_type: ConnectionType;
  /** Optional consultant note on this connection. Max 500 chars. */
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Layout persistence
// ---------------------------------------------------------------------------

/**
 * Persisted canvas state for a consultation.
 * Stored as JSONB in Postgres; projected into Neo4j node properties.
 */
export interface CanvasLayout {
  consultation_id: string;
  /** node_id -> position map for fast lookup. */
  positions: Record<string, CanvasPosition>;
  /** Viewport transform for restoring pan/zoom. */
  viewport: CanvasViewport;
  /** Timestamp of last layout save. */
  saved_at: string;
}

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

// ---------------------------------------------------------------------------
// AI connection suggestions
// ---------------------------------------------------------------------------

export type AiSuggestionStatus = "pending" | "accepted" | "rejected";

export interface AiConnectionSuggestion {
  id: string;
  consultation_id: string;
  source_node_id: string;
  target_node_id: string;
  suggested_connection_type: ConnectionType;
  /** Model-generated rationale shown to the consultant. */
  rationale: string;
  status: AiSuggestionStatus;
  /** Set when consultant accepts or rejects. */
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Network snapshot — consumed by report threading (Agent 3)
// ---------------------------------------------------------------------------

/**
 * Immutable snapshot of the evidence network captured at report generation time.
 * Stored in RoundOutputArtifact.input_snapshot under key "network".
 *
 * This is the contract Agent 3 reads to render the network section of a report.
 */
export interface NetworkSnapshot {
  /** Snapshot version — bump when shape changes. */
  version: 1;
  captured_at: string;
  consultation_id: string;
  nodes: NetworkSnapshotNode[];
  edges: NetworkSnapshotEdge[];
}

export interface NetworkSnapshotNode {
  id: string;
  type: CanvasNodeType;
  label: string;
  accepted: boolean;
  subgroup: string | null;
}

export interface NetworkSnapshotEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  connection_type: ConnectionType;
  note: string | null;
}

// ---------------------------------------------------------------------------
// Quick filter state (UI-only — not persisted)
// ---------------------------------------------------------------------------

export interface CanvasFilterState {
  nodeTypes: CanvasNodeType[];
  connectionTypes: ConnectionType[];
  subgroups: string[];
  acceptedOnly: boolean;
  searchQuery: string;
}

export function defaultFilterState(): CanvasFilterState {
  return {
    nodeTypes: ["theme", "insight"],
    connectionTypes: ["causes", "influences", "supports", "contradicts", "related_to"],
    subgroups: [],
    acceptedOnly: false,
    searchQuery: "",
  };
}

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
 * "context"     — A provides contextual framing for B (used by research-sourced
 *                 insights to mark background/methodological evidence)
 * "related_to"  — generic / unclassified relationship
 */
export type ConnectionType =
  | "causes"
  | "influences"
  | "supports"
  | "contradicts"
  | "context"
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
/**
 * Versioned snapshot. Consumers MUST gate on `version`.
 * v1: legacy — semantic only, no positions, no frames.
 * v2: spatial — includes node positions, frames with images, full canvas image.
 */
export type NetworkSnapshot = NetworkSnapshotV1 | NetworkSnapshotV2;

export interface NetworkSnapshotV1 {
  version: 1;
  captured_at: string;
  consultation_id: string;
  nodes: NetworkSnapshotNodeV1[];
  edges: NetworkSnapshotEdge[];
}

export interface NetworkSnapshotV2 {
  version: 2;
  captured_at: string;
  consultation_id: string;
  /** Frames present at capture time. Empty array if consultant created none. */
  frames: NetworkSnapshotFrame[];
  nodes: NetworkSnapshotNode[];
  edges: NetworkSnapshotEdge[];
  /** Captured image URL for the full canvas. Null if capture failed. */
  graph_image_url: string | null;
}

/** v1 node shape — no spatial data. Kept for backward compat. */
export interface NetworkSnapshotNodeV1 {
  id: string;
  type: CanvasNodeType;
  label: string;
  accepted: boolean;
  subgroup: string | null;
}

/** v2 node shape — adds position + frame membership. */
export interface NetworkSnapshotNode extends NetworkSnapshotNodeV1 {
  position: CanvasPosition;
  frame_id: string | null;
}

export interface NetworkSnapshotEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  connection_type: ConnectionType;
  note: string | null;
}

/** v2: per-frame snapshot record with cropped image URL. */
export interface NetworkSnapshotFrame {
  id: string;
  name: string;
  color: FrameColor;
  x: number;
  y: number;
  width: number;
  height: number;
  node_ids: string[];
  image_url: string | null;
}

// ---------------------------------------------------------------------------
// Canvas frames — spatial bounding-box containers on the canvas
// ---------------------------------------------------------------------------

/** 6-value palette for frame tinting. Stored as text in DB. */
export type FrameColor =
  | "amber"
  | "blue"
  | "green"
  | "purple"
  | "rose"
  | "slate";

export const FRAME_COLORS: readonly FrameColor[] = [
  "amber",
  "blue",
  "green",
  "purple",
  "rose",
  "slate",
] as const;

export const DEFAULT_FRAME_COLOR: FrameColor = "blue";

/**
 * A named spatial container on the canvas. Frames are visible rectangles the
 * consultant draws to group nodes by region — like a Figma frame or Miro
 * section. Nodes are assigned to a frame explicitly (via drag-into or
 * spatial-overlap on creation), not derived from position at render time.
 *
 * Membership is stored in `node_ids` so consumers can filter without doing
 * geometry. Position/size live in `x/y/width/height` (canvas flow coords).
 *
 * `viewport` is retained for back-compat with sprint 16 task 02 (it captured
 * a saved camera). New frames default to the canvas viewport at creation
 * time but the field is no longer the primary mental model.
 */
export interface CanvasFrame {
  id: string;
  consultation_id: string;
  name: string;
  /** Bounding box in canvas flow coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Palette tint for visual distinction on dense canvases. */
  color: FrameColor;
  /** Explicit member node IDs. Updated on drag-in/drag-out and resize. */
  node_ids: string[];
  /** Saved camera at frame creation time — kept for "zoom to frame" UX. */
  viewport: CanvasViewport;
  /** Display order in the frame bar (ascending). */
  position: number;
  created_at: string;
  updated_at: string;
}

export const CANVAS_CLUTTER_THRESHOLD = 15;

/** Default size for a programmatically-created frame (toolbar button fallback). */
export const DEFAULT_FRAME_WIDTH = 600;
export const DEFAULT_FRAME_HEIGHT = 400;

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

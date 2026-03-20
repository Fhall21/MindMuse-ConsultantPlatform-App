// Graph type contracts for the evidence network canvas.
// These types are the interface boundary between:
//   - the Postgres schema (canvas_connections, canvas_layout_state, graph_outbox)
//   - the canvas UI (Agent 1)
//   - the report snapshot (Agent 3)
//   - the graph projection worker (Neo4j write path)

// ============================================================
// Domain enums
// ============================================================

export type GraphNodeType = 'theme' | 'insight' | 'person' | 'group';

export type ConnectionType =
  | 'related_to'
  | 'supports'
  | 'contradicts'
  | 'escalates'
  | 'resolves'
  | 'involves';

export type ConnectionOrigin = 'manual' | 'ai_suggested';

export type RoundThemeGroupStatus =
  | 'draft'
  | 'accepted'
  | 'discarded'
  | 'management_rejected';

// ============================================================
// Database row types
// ============================================================

export interface CanvasConnection {
  id: string;
  roundId: string;
  userId: string;
  fromNodeType: GraphNodeType;
  fromNodeId: string;
  toNodeType: GraphNodeType;
  toNodeId: string;
  connectionType: ConnectionType;
  notes: string | null;
  confidence: number | null; // 0.000–1.000; only set for ai_suggested
  origin: ConnectionOrigin;
  aiSuggestionAcceptedAt: string | null; // ISO timestamp; null = pending review
  aiSuggestionRationale: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasLayoutState {
  id: string;
  roundId: string;
  userId: string;
  nodeType: GraphNodeType | 'viewport';
  nodeId: string; // = roundId when nodeType = 'viewport'
  posX: number | null;
  posY: number | null;
  width: number | null;  // group containers only
  height: number | null; // group containers only
  zoom: number | null;   // viewport row only
  panX: number | null;   // viewport row only
  panY: number | null;   // viewport row only
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Outbox event payloads
// graph_outbox.payload is typed here for the projection worker.
// ============================================================

export type GraphOutboxEventType =
  | 'connection_added'
  | 'connection_updated'
  | 'connection_removed'
  | 'membership_added'
  | 'membership_removed'
  | 'group_added'
  | 'group_updated'
  | 'group_removed';

export interface ConnectionAddedPayload {
  connectionId: string;
  roundId: string;
  fromNodeType: GraphNodeType;
  fromNodeId: string;
  toNodeType: GraphNodeType;
  toNodeId: string;
  connectionType: ConnectionType;
  notes: string | null;
  confidence: number | null;
  origin: ConnectionOrigin;
  aiSuggestionAcceptedAt: string | null;
}

export type ConnectionUpdatedPayload = ConnectionAddedPayload;

export interface ConnectionRemovedPayload {
  connectionId: string;
  roundId: string;
}

export interface MembershipAddedPayload {
  memberId: string;
  roundId: string;
  groupId: string;
  themeId: string;
  sourceConsultationId: string;
  position: number;
}

export interface MembershipRemovedPayload {
  memberId: string;
  roundId: string;
  groupId: string;
  themeId: string;
}

export interface GroupAddedPayload {
  groupId: string;
  roundId: string;
  label: string;
  status: RoundThemeGroupStatus;
  origin: 'manual' | 'ai_refined';
}

export interface GroupUpdatedPayload {
  groupId: string;
  roundId: string;
  label: string;
  status: RoundThemeGroupStatus;
}

export interface GroupRemovedPayload {
  groupId: string;
  roundId: string;
}

export type GraphOutboxPayload =
  | ConnectionAddedPayload
  | ConnectionUpdatedPayload
  | ConnectionRemovedPayload
  | MembershipAddedPayload
  | MembershipRemovedPayload
  | GroupAddedPayload
  | GroupUpdatedPayload
  | GroupRemovedPayload;

export interface GraphOutboxEvent {
  id: number; // bigserial — stable for replay ordering
  roundId: string;
  userId: string;
  eventType: GraphOutboxEventType;
  sourceTable: 'canvas_connections' | 'round_theme_group_members' | 'round_theme_groups';
  sourceId: string;
  payload: GraphOutboxPayload;
  processedAt: string | null;
  createdAt: string;
}

// ============================================================
// Graph network snapshot
// Used in round_output_artifacts.input_snapshot.graphNetwork
// and as the input to report generation.
// ============================================================

export interface GraphSnapshotNode {
  nodeType: GraphNodeType;
  nodeId: string;
  label: string;
  // Additional fields carried for report context only — not stored back to Postgres
  meta?: Record<string, unknown>;
}

export interface GraphSnapshotEdge {
  connectionId: string;
  fromNodeType: GraphNodeType;
  fromNodeId: string;
  toNodeType: GraphNodeType;
  toNodeId: string;
  connectionType: ConnectionType;
  notes: string | null;
  origin: ConnectionOrigin;
  // AI-suggested edges that have been explicitly accepted are included;
  // pending (unreviewed) AI suggestions are excluded from snapshots.
}

export interface LayoutStateEntry {
  nodeType: GraphNodeType | 'viewport';
  nodeId: string;
  posX: number | null;
  posY: number | null;
  width: number | null;
  height: number | null;
  zoom: number | null;
  panX: number | null;
  panY: number | null;
}

export interface GraphNetworkSnapshot {
  snapshotAt: string; // ISO timestamp — pinned at report generation time
  nodes: GraphSnapshotNode[];
  edges: GraphSnapshotEdge[];
  layoutState: LayoutStateEntry[];
}

// ============================================================
// round_output_artifacts.input_snapshot shape extension
// The existing field is jsonb; this extends it for graph-aware reports.
// ============================================================

export interface RoundInputSnapshot {
  // existing fields (from prior sprint)
  roundId: string;
  groups?: unknown[];
  themes?: unknown[];
  // Stage 6 addition — present only if the round has a canvas network
  graphNetwork?: GraphNetworkSnapshot;
}

// ============================================================
// Canvas UI helper types (consumed by Agent 1)
// ============================================================

export interface CanvasNode {
  id: string;
  type: GraphNodeType;
  label: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  data?: Record<string, unknown>;
}

export interface CanvasEdge {
  id: string;
  source: string; // `${fromNodeType}:${fromNodeId}`
  target: string; // `${toNodeType}:${toNodeId}`
  connectionType: ConnectionType;
  origin: ConnectionOrigin;
  isPendingReview: boolean; // true when origin = 'ai_suggested' && aiSuggestionAcceptedAt = null
  notes: string | null;
  confidence: number | null;
}

export interface CanvasViewport {
  zoom: number;
  panX: number;
  panY: number;
}

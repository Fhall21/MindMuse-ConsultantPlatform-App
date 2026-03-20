import type {
  ConnectionOrigin,
  ConnectionType,
  GraphNetworkSnapshot,
  GraphNodeType,
  GraphSnapshotEdge,
  GraphSnapshotNode,
} from "@/lib/graph/types";

export interface LegacyAcceptedRoundTheme {
  label: string;
  description?: string | null;
  source_kind?: string | null;
  grouped_under?: string | null;
  consultation_title?: string | null;
  is_user_added?: boolean;
}

export interface LegacySupportingConsultationTheme {
  label: string;
  description?: string | null;
  source_kind?: string | null;
  consultation_title?: string | null;
  grouped_under?: string | null;
  is_user_added?: boolean;
}

export interface ReportInputSnapshot {
  roundId?: string;
  round_id?: string;
  groups?: unknown[];
  themes?: unknown[];
  consultations?: string[];
  accepted_round_themes?: LegacyAcceptedRoundTheme[];
  supporting_consultation_themes?: LegacySupportingConsultationTheme[];
  graphNetwork?: GraphNetworkSnapshot;
}

interface SnapshotThemeGroupInput {
  id: string;
  label: string;
  description: string | null;
  status: string;
  origin: string;
  members: Array<{
    insightId: string;
    sourceConsultationId: string;
    sourceConsultationTitle: string;
    label: string;
    description: string | null;
    isUserAdded: boolean;
    position: number;
  }>;
}

interface SnapshotSourceThemeInput {
  sourceThemeId: string;
  consultationId: string;
  consultationTitle: string;
  label: string;
  description: string | null;
  effectiveIncluded: boolean;
  groupId: string | null;
  groupLabel: string | null;
  isUserAdded: boolean;
  createdAt: string;
}

export interface ReportGraphNodeSummary {
  key: string;
  label: string;
  nodeType: GraphNodeType;
  description: string | null;
  consultationTitle: string | null;
  groupLabel: string | null;
  isUserAdded: boolean;
  memberCount: number | null;
  degree: number;
}

export interface ReportGraphConnectionSummary {
  key: string;
  fromLabel: string;
  toLabel: string;
  connectionType: ConnectionType;
  origin: ConnectionOrigin;
  notes: string | null;
}

export interface ReportGraphModel {
  snapshot: GraphNetworkSnapshot;
  acceptedThemeCount: number;
  supportingThemeCount: number;
  connectionCount: number;
  nodeCount: number;
  nodes: ReportGraphNodeSummary[];
  groupNodes: ReportGraphNodeSummary[];
  insightNodes: ReportGraphNodeSummary[];
  topNodes: ReportGraphNodeSummary[];
  connections: ReportGraphConnectionSummary[];
  connectionsByType: Array<{
    type: ConnectionType;
    label: string;
    connections: ReportGraphConnectionSummary[];
  }>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nodeKey(nodeType: GraphNodeType, nodeId: string) {
  return `${nodeType}:${nodeId}`;
}

function connectionSort(
  left: ReportGraphConnectionSummary,
  right: ReportGraphConnectionSummary
) {
  return (
    left.connectionType.localeCompare(right.connectionType) ||
    left.fromLabel.localeCompare(right.fromLabel) ||
    left.toLabel.localeCompare(right.toLabel)
  );
}

function getNodeDescription(node: GraphSnapshotNode) {
  const meta = asRecord(node.meta);
  return asString(meta?.description ?? null);
}

function getNodeConsultationTitle(node: GraphSnapshotNode) {
  const meta = asRecord(node.meta);
  return asString(meta?.consultationTitle ?? null);
}

function getNodeGroupLabel(node: GraphSnapshotNode) {
  const meta = asRecord(node.meta);
  return asString(meta?.groupLabel ?? null);
}

function getNodeIsUserAdded(node: GraphSnapshotNode) {
  const meta = asRecord(node.meta);
  return meta?.isUserAdded === true;
}

function getNodeMemberCount(node: GraphSnapshotNode) {
  const meta = asRecord(node.meta);
  return asNumber(meta?.memberCount ?? null);
}

export function formatConnectionTypeLabel(value: ConnectionType): string {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function toReportInputSnapshot(
  value: Record<string, unknown> | ReportInputSnapshot
): ReportInputSnapshot {
  const snapshot = value as ReportInputSnapshot;
  return {
    ...snapshot,
    roundId: snapshot.roundId ?? snapshot.round_id,
  };
}

export function getGraphSnapshot(
  value: Record<string, unknown> | ReportInputSnapshot
): GraphNetworkSnapshot | null {
  const snapshot = toReportInputSnapshot(value).graphNetwork;

  if (
    !snapshot ||
    !Array.isArray(snapshot.nodes) ||
    !Array.isArray(snapshot.edges) ||
    !Array.isArray(snapshot.layoutState)
  ) {
    return null;
  }

  return snapshot;
}

export function buildReportGraphModel(
  value: Record<string, unknown> | ReportInputSnapshot
): ReportGraphModel | null {
  const snapshot = getGraphSnapshot(value);

  if (!snapshot) {
    return null;
  }

  const degreeByNodeKey = new Map<string, number>();
  const nodeByKey = new Map<string, GraphSnapshotNode>();

  snapshot.nodes.forEach((node) => {
    nodeByKey.set(nodeKey(node.nodeType, node.nodeId), node);
    degreeByNodeKey.set(nodeKey(node.nodeType, node.nodeId), 0);
  });

  const connections = snapshot.edges
    .map((edge): ReportGraphConnectionSummary | null => {
      const from = nodeByKey.get(nodeKey(edge.fromNodeType, edge.fromNodeId));
      const to = nodeByKey.get(nodeKey(edge.toNodeType, edge.toNodeId));

      if (!from || !to) {
        return null;
      }

      degreeByNodeKey.set(
        nodeKey(edge.fromNodeType, edge.fromNodeId),
        (degreeByNodeKey.get(nodeKey(edge.fromNodeType, edge.fromNodeId)) ?? 0) + 1
      );
      degreeByNodeKey.set(
        nodeKey(edge.toNodeType, edge.toNodeId),
        (degreeByNodeKey.get(nodeKey(edge.toNodeType, edge.toNodeId)) ?? 0) + 1
      );

      return {
        key: edge.connectionId,
        fromLabel: from.label,
        toLabel: to.label,
        connectionType: edge.connectionType,
        origin: edge.origin,
        notes: edge.notes,
      };
    })
    .filter((value): value is ReportGraphConnectionSummary => value !== null)
    .sort(connectionSort);

  const nodes = snapshot.nodes
    .map((node): ReportGraphNodeSummary => ({
      key: nodeKey(node.nodeType, node.nodeId),
      label: node.label,
      nodeType: node.nodeType,
      description: getNodeDescription(node),
      consultationTitle: getNodeConsultationTitle(node),
      groupLabel: getNodeGroupLabel(node),
      isUserAdded: getNodeIsUserAdded(node),
      memberCount: getNodeMemberCount(node),
      degree: degreeByNodeKey.get(nodeKey(node.nodeType, node.nodeId)) ?? 0,
    }))
    .sort((left, right) => {
      return (
        right.degree - left.degree ||
        left.label.localeCompare(right.label) ||
        left.nodeType.localeCompare(right.nodeType)
      );
    });

  const groupNodes = nodes.filter((node) => node.nodeType === "group");
  const insightNodes = nodes.filter((node) => node.nodeType === "insight");

  const connectionsByType = Array.from(
    connections.reduce(
      (map, connection) => {
        const existing = map.get(connection.connectionType) ?? [];
        existing.push(connection);
        map.set(connection.connectionType, existing);
        return map;
      },
      new Map<ConnectionType, ReportGraphConnectionSummary[]>()
    )
  )
    .map(([type, groupedConnections]) => ({
      type,
      label: formatConnectionTypeLabel(type),
      connections: groupedConnections.sort(connectionSort),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

  return {
    snapshot,
    acceptedThemeCount: groupNodes.length,
    supportingThemeCount: insightNodes.length,
    connectionCount: connections.length,
    nodeCount: snapshot.nodes.length,
    nodes,
    groupNodes,
    insightNodes,
    topNodes: nodes.slice(0, 6),
    connections,
    connectionsByType,
  };
}

export function buildLegacyReportGraphSnapshot(params: {
  roundId: string;
  snapshotAt: string;
  themeGroups: SnapshotThemeGroupInput[];
  sourceThemes: SnapshotSourceThemeInput[];
}): GraphNetworkSnapshot {
  const { roundId, snapshotAt, themeGroups, sourceThemes } = params;

  const acceptedGroups = themeGroups.filter((group) => group.status === "accepted");
  const groupById = new Map(acceptedGroups.map((group) => [group.id, group]));
  const nodes: GraphSnapshotNode[] = [];
  const edges: GraphSnapshotEdge[] = [];

  acceptedGroups.forEach((group) => {
    nodes.push({
      nodeType: "group",
      nodeId: group.id,
      label: group.label,
      meta: {
        description: group.description,
        origin: group.origin,
        status: group.status,
        memberCount: group.members.length,
      },
    });
  });

  sourceThemes
    .filter((theme) => theme.effectiveIncluded)
    .forEach((theme) => {
      nodes.push({
        nodeType: "insight",
        nodeId: theme.sourceThemeId,
        label: theme.label,
        meta: {
          description: theme.description,
          consultationId: theme.consultationId,
          consultationTitle: theme.consultationTitle,
          groupId: theme.groupId,
          groupLabel: theme.groupLabel,
          isUserAdded: theme.isUserAdded,
          createdAt: theme.createdAt,
        },
      });

      if (theme.groupId && groupById.has(theme.groupId)) {
        edges.push({
          connectionId: `support:${theme.sourceThemeId}:${theme.groupId}`,
          fromNodeType: "insight",
          fromNodeId: theme.sourceThemeId,
          toNodeType: "group",
          toNodeId: theme.groupId,
          connectionType: "supports",
          notes: null,
          origin: "manual",
        });
      }
    });

  return {
    snapshotAt,
    nodes,
    edges,
    layoutState: [
      {
        nodeType: "viewport",
        nodeId: roundId,
        posX: null,
        posY: null,
        width: null,
        height: null,
        zoom: null,
        panX: null,
        panY: null,
      },
    ],
  };
}

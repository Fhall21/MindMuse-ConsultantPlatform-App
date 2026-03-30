// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReportGraphModel } from "@/lib/report-graph";
import {
  buildNetworkDiagramElements,
  getNetworkDiagramMode,
  NetworkDiagram,
} from "@/components/reports/network-diagram";

vi.mock("@xyflow/react", () => ({
  Background: () => <div data-testid="react-flow-background" />,
  MarkerType: {
    ArrowClosed: "arrowclosed",
  },
  ReactFlow: ({ nodes, edges, children }: { nodes: unknown[]; edges: unknown[]; children?: React.ReactNode }) => (
    <div data-testid="react-flow" data-node-count={nodes.length} data-edge-count={edges.length}>
      {children}
    </div>
  ),
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@xyflow/react/dist/style.css", () => ({}));

function createGraphModel(params?: {
  nodeCount?: number;
  connectionCount?: number;
}): ReportGraphModel {
  const nodeCount = params?.nodeCount ?? 3;
  const connectionCount = params?.connectionCount ?? Math.max(nodeCount - 1, 0);

  const nodes = Array.from({ length: nodeCount }, (_, index) => {
    if (index === 0) {
      return {
        key: "group:group-1",
        label: "Operational pressures",
        nodeType: "group" as const,
        description: "Accepted theme group",
        consultationTitle: null,
        groupLabel: null,
        isUserAdded: false,
        memberCount: 2,
        degree: 2,
      };
    }

    return {
      key: `insight:insight-${index}`,
      label: `Insight ${index}`,
      nodeType: "insight" as const,
      description: `Supporting theme ${index}`,
      consultationTitle: `Meeting ${index}`,
      groupLabel: "Operational pressures",
      isUserAdded: false,
      memberCount: null,
      degree: 1,
    };
  });

  const edges = Array.from({ length: connectionCount }, (_, index) => ({
    connectionId: `edge-${index}`,
    fromNodeType: "insight" as const,
    fromNodeId: `insight-${Math.min(index + 1, nodeCount - 1)}`,
    toNodeType: "group" as const,
    toNodeId: "group-1",
    connectionType: "supports" as const,
    notes: index === 0 ? "This relationship matters" : null,
    origin: "manual" as const,
  }));

  return {
    snapshot: {
      snapshotAt: "2026-03-30T12:00:00.000Z",
      nodes: nodes.map((node) => ({
        nodeType: node.nodeType,
        nodeId: node.key.split(":")[1],
        label: node.label,
        meta: {
          description: node.description,
          consultationTitle: node.consultationTitle,
          memberCount: node.memberCount,
        },
      })),
      edges,
      layoutState: [],
    },
    acceptedThemeCount: 1,
    supportingThemeCount: Math.max(nodeCount - 1, 0),
    connectionCount,
    nodeCount,
    nodes,
    groupNodes: nodes.filter((node) => node.nodeType === "group"),
    insightNodes: nodes.filter((node) => node.nodeType === "insight"),
    topNodes: nodes.slice(0, 6),
    connections: edges.map((edge, index) => ({
      key: edge.connectionId,
      fromLabel: `Insight ${Math.min(index + 1, nodeCount - 1)}`,
      toLabel: "Operational pressures",
      connectionType: edge.connectionType,
      origin: edge.origin,
      notes: edge.notes,
    })),
    connectionsByType: connectionCount
      ? [
          {
            type: "supports",
            label: "Supports",
            connections: edges.map((edge, index) => ({
              key: edge.connectionId,
              fromLabel: `Insight ${Math.min(index + 1, nodeCount - 1)}`,
              toLabel: "Operational pressures",
              connectionType: edge.connectionType,
              origin: edge.origin,
              notes: edge.notes,
            })),
          },
        ]
      : [],
  };
}

describe("NetworkDiagram", () => {
  it("returns an empty mode when there are no typed connections", () => {
    expect(getNetworkDiagramMode(createGraphModel({ connectionCount: 0 }))).toBe("empty");
  });

  it("falls back to the compact grouped list when the node count exceeds the threshold", () => {
    render(<NetworkDiagram graphModel={createGraphModel({ nodeCount: 16, connectionCount: 4 })} />);

    expect(screen.getByText(/Compact grouped list shown because this network has 16 nodes/i)).toBeInTheDocument();
    expect(screen.queryByTestId("react-flow")).not.toBeInTheDocument();
  });

  it("builds diagram elements with edge labels for small graphs", () => {
    const elements = buildNetworkDiagramElements(createGraphModel({ nodeCount: 4, connectionCount: 3 }));

    expect(elements.nodes).toHaveLength(4);
    expect(elements.edges).toHaveLength(3);
    expect(elements.edges[0]?.label).toBe("Supports");
  });

  it("renders a static react flow canvas for small graphs", () => {
    render(<NetworkDiagram graphModel={createGraphModel({ nodeCount: 4, connectionCount: 3 })} />);

    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-node-count", "4");
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-edge-count", "3");
  });
});
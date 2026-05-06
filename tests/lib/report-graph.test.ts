import { describe, expect, it } from "vitest";

import {
  buildLegacyReportGraphSnapshot,
  buildReportGraphFrameModels,
  buildReportGraphModel,
  getAcceptedConsultationThemes,
  getGraphSnapshot,
  getMeetingTitles,
  getSupportingMeetingThemes,
  toReportInputSnapshot,
} from "@/lib/report-graph";
import type { GraphNetworkSnapshot } from "@/lib/graph/types";

describe("lib/report-graph", () => {
  it("normalizes legacy report snapshot keys into the stage-8 names", () => {
    const acceptedThemes = [{ label: "Workload" }];
    const supportingThemes = [{ label: "Burnout risk" }];

    expect(
      toReportInputSnapshot({
        round_id: "consultation-1",
        consultations: ["Meeting A"],
        accepted_round_themes: acceptedThemes,
        supporting_consultation_themes: supportingThemes,
      })
    ).toMatchObject({
      consultationId: "consultation-1",
      roundId: "consultation-1",
      meetingTitles: ["Meeting A"],
      consultations: ["Meeting A"],
      accepted_consultation_themes: acceptedThemes,
      accepted_round_themes: acceptedThemes,
      supporting_meeting_themes: supportingThemes,
      supporting_consultation_themes: supportingThemes,
    });
  });

  it("reads stage-8 snapshot keys directly through the compatibility helpers", () => {
    const snapshot = {
      consultationId: "consultation-2",
      meetingTitles: ["Meeting B"],
      accepted_consultation_themes: [{ label: "Communication" }],
      supporting_meeting_themes: [{ label: "Coverage gap" }],
    };

    expect(getMeetingTitles(snapshot)).toEqual(["Meeting B"]);
    expect(getAcceptedConsultationThemes(snapshot)).toEqual([
      { label: "Communication" },
    ]);
    expect(getSupportingMeetingThemes(snapshot)).toEqual([
      { label: "Coverage gap" },
    ]);
  });

  it("uses the saved graphNetwork snapshot as the report visual source of truth", () => {
    const graphNetwork: GraphNetworkSnapshot = {
      snapshotAt: "2026-05-06T00:00:00.000Z",
      nodes: [
        {
          nodeType: "group",
          nodeId: "group-1",
          label: "Operational risk",
          meta: { description: "Accepted group", memberCount: 2 },
        },
        {
          nodeType: "group",
          nodeId: "group-2",
          label: "Customer escalation",
          meta: { description: "Second accepted group", memberCount: 1 },
        },
      ],
      edges: [
        {
          connectionId: "edge-user-1",
          fromNodeType: "group",
          fromNodeId: "group-1",
          toNodeType: "group",
          toNodeId: "group-2",
          connectionType: "escalates",
          notes: "User linked the canvas story.",
          origin: "manual",
        },
      ],
      layoutState: [
        {
          nodeType: "group",
          nodeId: "group-1",
          posX: 120,
          posY: 240,
          width: 280,
          height: 160,
          zoom: null,
          panX: null,
          panY: null,
        },
        {
          nodeType: "group",
          nodeId: "group-2",
          posX: 560,
          posY: 240,
          width: 280,
          height: 160,
          zoom: null,
          panX: null,
          panY: null,
        },
        {
          nodeType: "viewport",
          nodeId: "round-1",
          posX: null,
          posY: null,
          width: null,
          height: null,
          zoom: 0.8,
          panX: -40,
          panY: 16,
        },
      ],
    };

    const model = buildReportGraphModel({
      roundId: "round-1",
      graphNetwork,
      accepted_consultation_themes: [{ label: "Operational risk" }],
      supporting_meeting_themes: [],
    });

    expect(model?.snapshot).toBe(graphNetwork);
    expect(model?.connectionCount).toBe(1);
    expect(model?.connections).toEqual([
      expect.objectContaining({
        key: "edge-user-1",
        fromLabel: "Operational risk",
        toLabel: "Customer escalation",
        connectionType: "escalates",
        notes: "User linked the canvas story.",
      }),
    ]);
    expect(model?.snapshot.layoutState).toContainEqual(
      expect.objectContaining({
        nodeType: "viewport",
        nodeId: "round-1",
        zoom: 0.8,
        panX: -40,
        panY: 16,
      })
    );
  });

  it("derives one frame snapshot by filtering nodes and edges from the saved graph", () => {
    const graphNetwork: GraphNetworkSnapshot = {
      snapshotAt: "2026-05-06T00:00:00.000Z",
      nodes: [
        { nodeType: "group", nodeId: "group-1", label: "Operational risk" },
        { nodeType: "group", nodeId: "group-2", label: "Customer escalation" },
        { nodeType: "insight", nodeId: "insight-1", label: "Late handoffs" },
      ],
      edges: [
        {
          connectionId: "edge-in-frame",
          fromNodeType: "insight",
          fromNodeId: "insight-1",
          toNodeType: "group",
          toNodeId: "group-1",
          connectionType: "supports",
          notes: null,
          origin: "manual",
        },
        {
          connectionId: "edge-out-of-frame",
          fromNodeType: "group",
          fromNodeId: "group-1",
          toNodeType: "group",
          toNodeId: "group-2",
          connectionType: "escalates",
          notes: null,
          origin: "manual",
        },
      ],
      layoutState: [
        {
          nodeType: "group",
          nodeId: "group-1",
          posX: 100,
          posY: 200,
          width: null,
          height: null,
          zoom: null,
          panX: null,
          panY: null,
        },
        {
          nodeType: "group",
          nodeId: "group-2",
          posX: 500,
          posY: 200,
          width: null,
          height: null,
          zoom: null,
          panX: null,
          panY: null,
        },
      ],
      frames: [
        {
          frameId: "frame-1",
          name: "Risk story",
          nodeIds: ["group-1", "insight-1"],
          position: 0,
          viewport: { x: -120, y: 40, zoom: 0.75 },
        },
      ],
    };

    const [frame] = buildReportGraphFrameModels({ graphNetwork });

    expect(frame.name).toBe("Risk story");
    expect(frame.graphModel.snapshot.nodes.map((node) => node.nodeId)).toEqual([
      "group-1",
      "insight-1",
    ]);
    expect(frame.graphModel.connections.map((connection) => connection.key)).toEqual([
      "edge-in-frame",
    ]);
    expect(frame.graphModel.snapshot.layoutState).toContainEqual(
      expect.objectContaining({
        nodeType: "viewport",
        nodeId: "frame-1",
        zoom: 0.75,
        panX: -120,
        panY: 40,
      })
    );
  });

  it("keeps multi-frame report views ordered and isolated", () => {
    const graphNetwork: GraphNetworkSnapshot = {
      snapshotAt: "2026-05-06T00:00:00.000Z",
      nodes: [
        { nodeType: "group", nodeId: "group-1", label: "Operational risk" },
        { nodeType: "group", nodeId: "group-2", label: "Customer escalation" },
      ],
      edges: [
        {
          connectionId: "edge-1",
          fromNodeType: "group",
          fromNodeId: "group-1",
          toNodeType: "group",
          toNodeId: "group-2",
          connectionType: "related_to",
          notes: null,
          origin: "manual",
        },
      ],
      layoutState: [],
      frames: [
        {
          frameId: "frame-2",
          name: "Second",
          nodeIds: ["group-2"],
          position: 2,
          viewport: { x: 0, y: 0, zoom: 1 },
        },
        {
          frameId: "frame-1",
          name: "First",
          nodeIds: ["group-1"],
          position: 1,
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      ],
    };

    const frames = buildReportGraphFrameModels({ graphNetwork });

    expect(frames.map((frame) => frame.name)).toEqual(["First", "Second"]);
    expect(frames.map((frame) => frame.graphModel.nodeCount)).toEqual([1, 1]);
    expect(frames.map((frame) => frame.graphModel.connectionCount)).toEqual([0, 0]);
  });

  it("returns no frame models for older artifacts without frame metadata", () => {
    const graphNetwork: GraphNetworkSnapshot = {
      snapshotAt: "2026-05-06T00:00:00.000Z",
      nodes: [{ nodeType: "group", nodeId: "group-1", label: "Operational risk" }],
      edges: [],
      layoutState: [],
    };

    expect(buildReportGraphFrameModels({ graphNetwork })).toEqual([]);
    expect(buildReportGraphModel({ graphNetwork })?.nodeCount).toBe(1);
  });

  it("degrades older or malformed artifacts instead of inventing report graph state", () => {
    expect(getGraphSnapshot({ roundId: "legacy-round" })).toBeNull();
    expect(
      getGraphSnapshot({
        graphNetwork: {
          snapshotAt: "2026-05-06T00:00:00.000Z",
          nodes: [],
          edges: [],
        },
      })
    ).toBeNull();
    expect(buildReportGraphModel({ roundId: "legacy-round" })).toBeNull();
  });

  it("marks legacy synthesized report snapshots as layout-degraded compatibility data", () => {
    const snapshot = buildLegacyReportGraphSnapshot({
      roundId: "round-legacy",
      snapshotAt: "2026-05-06T00:00:00.000Z",
      themeGroups: [
        {
          id: "group-1",
          label: "Operational risk",
          description: "Accepted group",
          status: "accepted",
          origin: "manual",
          members: [],
        },
      ],
      sourceThemes: [
        {
          sourceThemeId: "insight-1",
          consultationId: "meeting-1",
          consultationTitle: "Meeting 1",
          label: "Late handoffs",
          description: "Teams described repeated delays.",
          effectiveIncluded: true,
          groupId: "group-1",
          groupLabel: "Operational risk",
          isUserAdded: false,
          createdAt: "2026-05-06T00:00:00.000Z",
        },
      ],
    });

    expect(snapshot.edges).toEqual([
      expect.objectContaining({
        connectionId: "support:insight-1:group-1",
        connectionType: "supports",
      }),
    ]);
    expect(snapshot.layoutState).toEqual([
      {
        nodeType: "viewport",
        nodeId: "round-legacy",
        posX: null,
        posY: null,
        width: null,
        height: null,
        zoom: null,
        panX: null,
        panY: null,
      },
    ]);
  });
});

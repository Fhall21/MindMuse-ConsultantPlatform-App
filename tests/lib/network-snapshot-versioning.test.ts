/**
 * Sprint 16 task 03.5 — version-gating contract for NetworkSnapshot.
 *
 * v1 snapshots have only semantic data (no positions, no frames).
 * v2 snapshots add node positions, frames with bounding boxes, and an
 * optional captured graph image URL.
 *
 * Consumers MUST gate on `snapshot.version` before reading v2-only fields.
 */
import { describe, expect, it } from "vitest";
import type {
  NetworkSnapshot,
  NetworkSnapshotV1,
  NetworkSnapshotV2,
} from "@/types/canvas";

describe("NetworkSnapshot v1", () => {
  const v1: NetworkSnapshotV1 = {
    version: 1,
    captured_at: "2026-05-01T00:00:00Z",
    consultation_id: "c1",
    nodes: [
      { id: "n1", type: "theme", label: "T", accepted: true, subgroup: null },
    ],
    edges: [],
  };

  it("has no positions", () => {
    expect((v1.nodes[0] as unknown as Record<string, unknown>).position).toBeUndefined();
  });

  it("has no frames or graph_image_url", () => {
    expect((v1 as unknown as Record<string, unknown>).frames).toBeUndefined();
    expect((v1 as unknown as Record<string, unknown>).graph_image_url).toBeUndefined();
  });
});

describe("NetworkSnapshot v2", () => {
  const v2: NetworkSnapshotV2 = {
    version: 2,
    captured_at: "2026-05-06T00:00:00Z",
    consultation_id: "c1",
    frames: [
      {
        id: "f1",
        name: "Risks",
        color: "rose",
        x: 0,
        y: 0,
        width: 400,
        height: 300,
        node_ids: ["n1"],
        image_url: null,
      },
    ],
    nodes: [
      {
        id: "n1",
        type: "theme",
        label: "Risk theme",
        accepted: true,
        subgroup: null,
        position: { x: 50, y: 50 },
        frame_id: "f1",
      },
    ],
    edges: [],
    graph_image_url: null,
  };

  it("nodes carry position + frame_id", () => {
    expect(v2.nodes[0]!.position).toEqual({ x: 50, y: 50 });
    expect(v2.nodes[0]!.frame_id).toBe("f1");
  });

  it("frames carry bounding box and color", () => {
    expect(v2.frames[0]).toMatchObject({
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      color: "rose",
    });
  });
});

describe("NetworkSnapshot consumer pattern", () => {
  /** Mirror the gating pattern that report-render-policy uses. */
  function consume(snapshot: NetworkSnapshot) {
    if (snapshot.version === 2) {
      return {
        hasFrames: snapshot.frames.length > 0,
        hasImage: snapshot.graph_image_url !== null,
        firstNodePosition: snapshot.nodes[0]?.position ?? null,
      };
    }
    return { hasFrames: false, hasImage: false, firstNodePosition: null };
  }

  it("gates v2 fields behind version check", () => {
    const v1: NetworkSnapshotV1 = {
      version: 1,
      captured_at: "2026-05-01T00:00:00Z",
      consultation_id: "c1",
      nodes: [{ id: "n", type: "theme", label: "T", accepted: false, subgroup: null }],
      edges: [],
    };
    expect(consume(v1)).toEqual({ hasFrames: false, hasImage: false, firstNodePosition: null });
  });
});

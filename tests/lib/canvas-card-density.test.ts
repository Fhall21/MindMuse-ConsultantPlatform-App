import { describe, expect, it } from "vitest";
import {
  cardHasClampableText,
  resolveCardExpanded,
  toggleExpandedOverride,
} from "@/lib/canvas-card-density";
import type { CanvasNode } from "@/types/canvas";

function makeNode(overrides: Partial<CanvasNode> = {}): CanvasNode {
  return {
    id: "n1",
    type: "insight",
    label: "Short",
    description: null,
    accepted: false,
    isBrainstorming: false,
    subgroup: null,
    sourceConsultationId: null,
    sourceConsultationTitle: null,
    groupId: null,
    memberIds: [],
    isUserAdded: false,
    lockedFromSource: false,
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

describe("resolveCardExpanded", () => {
  it("follows global compact by default", () => {
    expect(resolveCardExpanded(undefined, "compact")).toBe(false);
    expect(resolveCardExpanded(undefined, "expanded")).toBe(true);
  });

  it("honours per-card overrides over global", () => {
    expect(resolveCardExpanded(true, "compact")).toBe(true);
    expect(resolveCardExpanded(false, "expanded")).toBe(false);
  });
});

describe("toggleExpandedOverride", () => {
  it("sets explicit expand in compact mode", () => {
    expect(toggleExpandedOverride(undefined, "compact")).toBe(true);
  });

  it("clears override when collapsing in compact mode", () => {
    expect(toggleExpandedOverride(true, "compact")).toBe(undefined);
  });

  it("sets explicit collapse in expanded mode", () => {
    expect(toggleExpandedOverride(undefined, "expanded")).toBe(false);
  });

  it("clears override when expanding in expanded mode", () => {
    expect(toggleExpandedOverride(false, "expanded")).toBe(undefined);
  });
});

describe("cardHasClampableText", () => {
  it("detects description and long labels", () => {
    expect(cardHasClampableText(makeNode())).toBe(false);
    expect(cardHasClampableText(makeNode({ description: "Evidence note" }))).toBe(true);
    expect(
      cardHasClampableText(
        makeNode({ label: "A".repeat(60) })
      )
    ).toBe(true);
  });

  it("never treats theme groups as clampable", () => {
    expect(
      cardHasClampableText(
        makeNode({
          type: "theme",
          description: "Long group description that would clamp on insight cards",
          label: "A".repeat(60),
        })
      )
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  extractResearchInsightSchema,
  placeResearchInsightSchema,
  quoteLocatorSchema,
} from "@/lib/validations/research-insight";

const baseExtract = {
  consultationId: "a1111111-1111-4111-8111-111111111111",
  researchSessionId: "b2222222-2222-4222-8222-222222222222",
  quote: "Workplace burnout is a structural problem, not a personal failing.",
  locator: { answerId: "ans-1" },
  label: "Burnout is structural",
  description: "Anchors the structural framing for the cross-consultation theme.",
};

describe("extractResearchInsightSchema", () => {
  it("accepts a minimal valid payload", () => {
    const r = extractResearchInsightSchema.safeParse(baseExtract);
    expect(r.success).toBe(true);
  });

  it("rejects a quote shorter than 8 characters", () => {
    const r = extractResearchInsightSchema.safeParse({ ...baseExtract, quote: "tiny" });
    expect(r.success).toBe(false);
  });

  it("requires a valid uuid for consultationId", () => {
    const r = extractResearchInsightSchema.safeParse({
      ...baseExtract,
      consultationId: "not-a-uuid",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a missing description (notes is required for audit trail)", () => {
    const { description: _drop, ...rest } = baseExtract;
    void _drop;
    const r = extractResearchInsightSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });

  it("accepts analysis locator fields end-to-end", () => {
    const r = extractResearchInsightSchema.safeParse({
      ...baseExtract,
      locator: {
        sourceKind: "artifact",
        artifactEntryId: "storage-entry-99",
        startOffset: 0,
        endOffset: 120,
      },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.locator).toEqual({
        sourceKind: "artifact",
        artifactEntryId: "storage-entry-99",
        startOffset: 0,
        endOffset: 120,
      });
    }
  });
});

describe("quoteLocatorSchema", () => {
  it("accepts an empty object (anchoring is best-effort)", () => {
    const r = quoteLocatorSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("accepts answerId only", () => {
    const r = quoteLocatorSchema.safeParse({ answerId: "ans-1" });
    expect(r.success).toBe(true);
  });

  it("rejects offsets where end <= start", () => {
    const r = quoteLocatorSchema.safeParse({
      answerId: "ans-1",
      startOffset: 100,
      endOffset: 100,
    });
    expect(r.success).toBe(false);
  });

  it("accepts a well-formed offset range", () => {
    const r = quoteLocatorSchema.safeParse({
      answerId: "ans-1",
      startOffset: 12,
      endOffset: 80,
    });
    expect(r.success).toBe(true);
  });

  it("accepts analysis artifact locator", () => {
    const r = quoteLocatorSchema.safeParse({
      sourceKind: "artifact",
      artifactEntryId: "entry-abc-123",
    });
    expect(r.success).toBe(true);
  });

  it("accepts analysis figure locator", () => {
    const r = quoteLocatorSchema.safeParse({
      sourceKind: "figure",
      figureKey: "cell-0-1",
    });
    expect(r.success).toBe(true);
  });

  it("accepts analysis notebook cell locator", () => {
    const r = quoteLocatorSchema.safeParse({
      sourceKind: "notebook_cell",
      notebookCellIndex: 3,
    });
    expect(r.success).toBe(true);
  });

  it("accepts analysis answer locator without companion fields", () => {
    const r = quoteLocatorSchema.safeParse({
      sourceKind: "answer",
      startOffset: 0,
      endOffset: 42,
    });
    expect(r.success).toBe(true);
  });

  it("rejects artifact sourceKind without artifactEntryId", () => {
    const r = quoteLocatorSchema.safeParse({ sourceKind: "artifact" });
    expect(r.success).toBe(false);
  });

  it("rejects figure sourceKind without figureKey", () => {
    const r = quoteLocatorSchema.safeParse({ sourceKind: "figure" });
    expect(r.success).toBe(false);
  });

  it("rejects notebook_cell sourceKind without notebookCellIndex", () => {
    const r = quoteLocatorSchema.safeParse({ sourceKind: "notebook_cell" });
    expect(r.success).toBe(false);
  });

  it("accepts analysis locator alongside literature fields", () => {
    const r = quoteLocatorSchema.safeParse({
      sourceKind: "artifact",
      artifactEntryId: "entry-1",
      startOffset: 10,
      endOffset: 50,
    });
    expect(r.success).toBe(true);
  });
});

describe("placeResearchInsightSchema", () => {
  it("requires both uuids", () => {
    const r = placeResearchInsightSchema.safeParse({
      consultationId: "a1111111-1111-4111-8111-111111111111",
      insightId: "b2222222-2222-4222-8222-222222222222",
    });
    expect(r.success).toBe(true);
  });

  it("rejects malformed uuids", () => {
    const r = placeResearchInsightSchema.safeParse({
      consultationId: "no",
      insightId: "no",
    });
    expect(r.success).toBe(false);
  });
});

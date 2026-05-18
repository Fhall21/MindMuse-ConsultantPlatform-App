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

  it("strips empty description to null", () => {
    const r = extractResearchInsightSchema.safeParse({
      ...baseExtract,
      description: "  ",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.description).toBeNull();
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

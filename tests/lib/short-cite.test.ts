import { describe, expect, it } from "vitest";
import {
  extractResearchReferences,
  researchReferenceFullCite,
  researchSessionShortCite,
} from "@/lib/citations/short-cite";

type ResearchSessionFixture = Parameters<typeof researchSessionShortCite>[0];

function makeSession(
  overrides: Partial<ResearchSessionFixture> = {}
): ResearchSessionFixture {
  return {
    id: "rs-1",
    userId: "u-1",
    sessionType: "literature",
    query: "What does the literature say about workplace burnout?",
    industryCtx: null,
    status: "complete",
    taskId: null,
    resultData: null,
    fileEntryId: null,
    completedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ResearchSessionFixture;
}

describe("researchSessionShortCite", () => {
  it("renders author + year when both are available", () => {
    const session = makeSession({
      resultData: {
        references: [
          {
            authors: "Smith, J.",
            year: "2024",
            title: "Burnout in modern workplaces",
          },
        ],
      },
    });
    expect(researchSessionShortCite(session)).toBe("Smith 2024");
  });

  it("falls back to a truncated query when no references exist", () => {
    const session = makeSession({
      query: "A".repeat(80),
    });
    const cite = researchSessionShortCite(session);
    expect(cite.length).toBeLessThanOrEqual(40);
  });

  it("derives the last name from a 'First Last' author string", () => {
    const session = makeSession({
      resultData: {
        references: [
          {
            authors: ["Jane Smith", "Alex Doe"],
            year: 2023,
            title: "Paper",
          },
        ],
      },
    });
    expect(researchSessionShortCite(session)).toBe("Smith 2023");
  });
});

describe("researchReferenceFullCite", () => {
  it("renders author + year + title + url", () => {
    expect(
      researchReferenceFullCite({
        authors: "Smith, J.",
        year: "2024",
        title: "Burnout in modern workplaces",
        url: "https://example.org/burnout",
      })
    ).toBe("Smith, J. (2024). Burnout in modern workplaces. https://example.org/burnout");
  });

  it("uses 'et al.' for 3+ authors", () => {
    expect(
      researchReferenceFullCite({
        authors: ["Smith", "Doe", "Tanaka", "Khan"],
        year: 2024,
        title: "Group paper",
      })
    ).toBe("Smith et al. (2024). Group paper.");
  });
});

describe("extractResearchReferences", () => {
  it("returns [] when resultData has no references array", () => {
    const session = makeSession({ resultData: { citation: "x" } });
    expect(extractResearchReferences(session)).toEqual([]);
  });

  it("returns the references array when present", () => {
    const refs = [{ title: "Paper one" }, { title: "Paper two" }];
    const session = makeSession({ resultData: { references: refs } });
    expect(extractResearchReferences(session)).toEqual(refs);
  });
});

import { describe, expect, it } from "vitest";
import {
  extractResearchReferences,
  researchReferenceFullCite,
  researchSessionFullCite,
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

  it("uses first artifact filename for analysis sessions", () => {
    const session = makeSession({
      sessionType: "analysis",
      query: "What patterns exist in employee turnover data?",
      resultData: {
        artifacts: [{ filename: "turnover_summary.csv" }],
      },
    });
    expect(researchSessionShortCite(session)).toBe("turnover_summary.csv");
  });

  it("falls back to truncated query for analysis sessions without artifacts", () => {
    const session = makeSession({
      sessionType: "analysis",
      query: "B".repeat(80),
      resultData: { answer: "Some analysis result" },
    });
    const cite = researchSessionShortCite(session);
    expect(cite.length).toBeLessThanOrEqual(40);
    expect(cite.startsWith("B")).toBe(true);
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

describe("researchSessionFullCite", () => {
  it("renders literature full cite from first reference", () => {
    const session = makeSession({
      resultData: {
        references: [
          {
            authors: "Smith, J.",
            year: "2024",
            title: "Burnout in modern workplaces",
            url: "https://example.org/burnout",
          },
        ],
      },
    });
    expect(researchSessionFullCite(session)).toBe(
      "Smith, J. (2024). Burnout in modern workplaces. https://example.org/burnout"
    );
  });

  it("renders analysis full cite with query and artifact filename", () => {
    const session = makeSession({
      sessionType: "analysis",
      query: "What drives turnover in Q3?",
      completedAt: new Date("2026-03-15T12:00:00Z"),
      resultData: {
        artifacts: [{ filename: "turnover_summary.csv" }],
      },
    });
    const cite = researchSessionFullCite(session);
    expect(cite).toContain("Data analysis");
    expect(cite).toContain("What drives turnover in Q3?");
    expect(cite).toContain("turnover_summary.csv");
  });

  it("falls back to query-only analysis cite when no artifacts", () => {
    const session = makeSession({
      sessionType: "analysis",
      query: "Summarise the dataset trends",
      completedAt: null,
      createdAt: null as unknown as Date,
      resultData: { answer: "Trends show…" },
    });
    expect(researchSessionFullCite(session)).toBe(
      "Data analysis: Summarise the dataset trends."
    );
  });
});

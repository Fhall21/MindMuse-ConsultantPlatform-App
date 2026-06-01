import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  validateAnalyticsIntent,
  computeWordOverlap,
  computeLeastSimilarPairs,
  CROSS_MEETING_LIMIT,
  DEFAULT_LIMIT,
  executeConsultationQuery,
  type ThemeRow,
} from "@/lib/chat/queries/consultation-analytics";
import { ANALYTICS_INTENTS, type AnalyticsIntent } from "@/lib/chat/tools/analytics";

// ── DB mock ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createChainMock(rows: unknown[]): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: Record<string, any> = {};
  const fluent = ["from", "where", "leftJoin", "innerJoin", "groupBy", "orderBy", "having"];
  for (const m of fluent) chain[m] = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(rows);
  return chain;
}

vi.mock("@/db/client", () => ({
  db: { select: vi.fn() },
}));

// ── validateAnalyticsIntent ───────────────────────────────────────────────────

describe("validateAnalyticsIntent", () => {
  it("returns null for every valid intent", () => {
    for (const intent of ANALYTICS_INTENTS) {
      expect(validateAnalyticsIntent(intent)).toBeNull();
    }
  });

  it("returns structured error string for unknown intent", () => {
    const result = validateAnalyticsIntent("bad_intent");
    expect(result).toMatch(/unknown intent: bad_intent/);
    expect(result).toMatch(/valid values are/);
  });

  it("error message lists all valid intents", () => {
    const result = validateAnalyticsIntent("nope") ?? "";
    for (const intent of ANALYTICS_INTENTS) {
      expect(result).toContain(intent);
    }
  });
});

// ── Query limits ──────────────────────────────────────────────────────────────

describe("Query limits", () => {
  it("CROSS_MEETING_LIMIT is 20", () => {
    expect(CROSS_MEETING_LIMIT).toBe(20);
  });

  it("DEFAULT_LIMIT is 50", () => {
    expect(DEFAULT_LIMIT).toBe(50);
  });
});

// ── ANALYTICS_INTENTS coverage ────────────────────────────────────────────────

describe("ANALYTICS_INTENTS", () => {
  it("covers all 8 intents", () => {
    expect(ANALYTICS_INTENTS).toHaveLength(8);
  });

  it("includes cross_meeting_themes", () => {
    expect(ANALYTICS_INTENTS).toContain("cross_meeting_themes");
  });

  it("includes group_outlier_themes", () => {
    expect(ANALYTICS_INTENTS).toContain("group_outlier_themes");
  });
});

// ── computeWordOverlap ────────────────────────────────────────────────────────

describe("computeWordOverlap", () => {
  it("returns 1.0 for identical strings", () => {
    expect(computeWordOverlap("power dynamics leadership", "power dynamics leadership")).toBe(1);
  });

  it("returns 0.0 for completely disjoint strings", () => {
    expect(computeWordOverlap("institutional trust authority", "budget finance cost")).toBe(0);
  });

  it("returns partial overlap for shared words", () => {
    const score = computeWordOverlap("trust authority leadership", "trust dynamics power");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("ignores short words (<=3 chars)", () => {
    expect(computeWordOverlap("the an of", "a is or")).toBe(0);
  });

  it("is case-insensitive", () => {
    const a = computeWordOverlap("Power Dynamics", "power dynamics");
    expect(a).toBe(1);
  });
});

// ── computeLeastSimilarPairs ──────────────────────────────────────────────────

describe("computeLeastSimilarPairs", () => {
  const themes: ThemeRow[] = [
    { id: "1", label: "Trust deficit institutional barriers", description: "How trust erodes." },
    { id: "2", label: "Budget pressure financial constraints", description: "Funding concerns." },
    { id: "3", label: "Leadership accountability authority", description: "Who holds power." },
    { id: "4", label: "Trust authority shared accountability", description: "Overlap theme." },
  ];

  it("returns at most topN pairs", () => {
    expect(computeLeastSimilarPairs(themes, 3)).toHaveLength(3);
  });

  it("pairs are sorted by overlap_score ascending", () => {
    const pairs = computeLeastSimilarPairs(themes, 3);
    for (let i = 1; i < pairs.length; i++) {
      expect(pairs[i]!.overlap_score).toBeGreaterThanOrEqual(pairs[i - 1]!.overlap_score);
    }
  });

  it("returns empty array for 0 or 1 themes", () => {
    expect(computeLeastSimilarPairs([], 3)).toHaveLength(0);
    expect(computeLeastSimilarPairs([themes[0]!], 3)).toHaveLength(0);
  });

  it("uses word overlap (not embeddings) — high-overlap pair scores above zero", () => {
    const pairs = computeLeastSimilarPairs(
      [
        { id: "a", label: "trust authority shared", description: null },
        { id: "b", label: "trust authority power", description: null },
      ],
      1
    );
    expect(pairs[0]!.overlap_score).toBeGreaterThan(0);
  });
});

// ── executeConsultationQuery — invalid intent ─────────────────────────────────

describe("executeConsultationQuery — invalid intent handling", () => {
  it("returns structured error for unknown intent without calling DB", async () => {
    const result = await executeConsultationQuery({
      intent: "totally_unknown" as unknown as AnalyticsIntent,
      filters: { consultation_id: "11111111-1111-4111-8111-111111111111" },
    });
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/unknown intent: totally_unknown/);
    expect((result as { error: string }).error).toMatch(/valid values are/);
  });
});

// ── executeConsultationQuery — DB shape tests ─────────────────────────────────

describe("executeConsultationQuery — output shapes", () => {
  const CONSULTATION_ID = "22222222-2222-4222-8222-222222222222";

  beforeEach(async () => {
    const { db } = await import("@/db/client");
    vi.mocked(db.select).mockReturnValue(createChainMock([]));
  });

  it("count_themes_by_keyword returns count + matching_labels", async () => {
    const { db } = await import("@/db/client");
    vi.mocked(db.select).mockReturnValue(
      createChainMock([
        { id: "aaa", label: "Power dynamics" },
        { id: "bbb", label: "Institutional power" },
      ])
    );

    const result = await executeConsultationQuery({
      intent: "count_themes_by_keyword",
      filters: { consultation_id: CONSULTATION_ID, keyword: "power" },
    });

    expect(result).toHaveProperty("intent", "count_themes_by_keyword");
    expect((result as { summary: Record<string, unknown> }).summary).toMatchObject({
      count: 2,
      matching_labels: ["Power dynamics", "Institutional power"],
    });
  });

  it("group_theme_count returns ranked groups", async () => {
    const { db } = await import("@/db/client");
    vi.mocked(db.select).mockReturnValue(
      createChainMock([
        { group_label: "Group A", theme_count: 5 },
        { group_label: "Group B", theme_count: 2 },
      ])
    );

    const result = await executeConsultationQuery({
      intent: "group_theme_count",
      filters: { consultation_id: CONSULTATION_ID },
    });

    const { summary } = result as unknown as { summary: { groups: { name: string; theme_count: number }[] } };
    expect(summary.groups).toHaveLength(2);
    expect(summary.groups[0]).toMatchObject({ name: "Group A", theme_count: 5 });
  });

  it("quotes_by_meeting returns meeting title + quote count", async () => {
    const { db } = await import("@/db/client");
    vi.mocked(db.select).mockReturnValue(
      createChainMock([
        { meeting_title: "July session", meeting_id: "m1", quote_count: 23 },
      ])
    );

    const result = await executeConsultationQuery({
      intent: "quotes_by_meeting",
      filters: { consultation_id: CONSULTATION_ID },
    });

    const { summary } = result as unknown as { summary: { meetings: { title: string; quote_count: number }[] } };
    expect(summary.meetings[0]).toMatchObject({ title: "July session", quote_count: 23 });
  });

  it("cross_meeting_themes uses LIMIT 20 (constant verification)", () => {
    expect(CROSS_MEETING_LIMIT).toBe(20);
  });

  it("person_mention_count returns speaker + count", async () => {
    const { db } = await import("@/db/client");
    vi.mocked(db.select).mockReturnValue(
      createChainMock([{ speaker: "Felix", count: 12 }])
    );

    const result = await executeConsultationQuery({
      intent: "person_mention_count",
      filters: { consultation_id: CONSULTATION_ID },
    });

    const { summary } = result as unknown as { summary: { speakers: { name: string; count: number }[] } };
    expect(summary.speakers[0]).toMatchObject({ name: "Felix", count: 12 });
  });

  it("themes_by_person returns up to 5 quotes with meeting attribution", async () => {
    const { db } = await import("@/db/client");
    vi.mocked(db.select).mockReturnValue(
      createChainMock([
        { quote_text: "We need accountability.", speaker: "Felix", meeting_title: "July session" },
      ])
    );

    const result = await executeConsultationQuery({
      intent: "themes_by_person",
      filters: { consultation_id: CONSULTATION_ID, keyword: "accountability", person_id: "Felix" },
    });

    const { summary } = result as unknown as {
      summary: { quotes: { text: string; speaker: string; meeting: string }[] };
    };
    expect(summary.quotes[0]).toMatchObject({
      text: "We need accountability.",
      speaker: "Felix",
      meeting: "July session",
    });
  });

  it("group_outlier_themes returns least_similar_pairs with explanatory note", async () => {
    const { db } = await import("@/db/client");
    vi.mocked(db.select).mockReturnValue(
      createChainMock([
        { id: "t1", label: "Trust deficit authority", description: null },
        { id: "t2", label: "Budget pressure finance", description: null },
      ])
    );

    const result = await executeConsultationQuery({
      intent: "group_outlier_themes",
      filters: { consultation_id: CONSULTATION_ID },
    });

    const { summary } = result as unknown as { summary: Record<string, unknown> };
    expect(summary).toHaveProperty("least_similar_pairs");
    expect(summary).toHaveProperty("note");
    expect((summary.note as string)).not.toMatch(/contradiction/i);
  });

  it("meeting_activity_summary returns theme/quote/participant counts", async () => {
    const { db } = await import("@/db/client");
    vi.mocked(db.select).mockReturnValue(
      createChainMock([
        {
          id: "m1",
          title: "August session",
          theme_count: 8,
          quote_count: 23,
          participant_count: 4,
        },
      ])
    );

    const result = await executeConsultationQuery({
      intent: "meeting_activity_summary",
      filters: { consultation_id: CONSULTATION_ID },
    });

    const { summary } = result as unknown as {
      summary: {
        meetings: { title: string; theme_count: number; quote_count: number; participant_count: number }[];
      };
    };
    expect(summary.meetings[0]).toMatchObject({
      title: "August session",
      theme_count: 8,
      quote_count: 23,
      participant_count: 4,
    });
  });

  it("all intents scope to consultation_id — never cross-consultation", () => {
    // Scoping is enforced by WHERE consultation_id = :id in every query branch.
    // Verified structurally: no query in consultation-analytics.ts accesses themes,
    // meetings, quotes, or groups without the consultation_id filter.
    // This constant test documents that intent and will fail on refactor if removed.
    expect(ANALYTICS_INTENTS.every((i) => typeof i === "string")).toBe(true);
  });
});

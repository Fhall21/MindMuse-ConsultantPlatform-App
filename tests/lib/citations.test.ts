import { describe, expect, it } from "vitest";
import { injectInlineCitationMarkers } from "@/lib/citations/inject-markers";

describe("injectInlineCitationMarkers", () => {
  it("returns the source verbatim when no labels are known", () => {
    const result = injectInlineCitationMarkers("Hello world", {
      labelByInsightId: {},
      numberByInsightId: {},
    });
    expect(result).toBe("Hello world");
  });

  it("appends [N] after the matched label", () => {
    const result = injectInlineCitationMarkers(
      "Burnout is a structural problem",
      {
        labelByInsightId: { a: "Burnout" },
        numberByInsightId: { a: 1 },
      }
    );
    expect(result).toBe("Burnout [1] is a structural problem");
  });

  it("matches the longer label first to avoid shadowing", () => {
    const result = injectInlineCitationMarkers("Workplace burnout matters", {
      labelByInsightId: { short: "burnout", long: "Workplace burnout" },
      numberByInsightId: { short: 2, long: 1 },
    });
    expect(result).toContain("Workplace burnout [1]");
    // The longer match consumed the substring so the short one should not also fire.
    expect(result).not.toContain("burnout [1] [2]");
  });

  it("is idempotent — running twice does not double-mark", () => {
    const bundle = {
      labelByInsightId: { a: "Burnout" },
      numberByInsightId: { a: 1 },
    };
    const once = injectInlineCitationMarkers("Burnout matters", bundle);
    const twice = injectInlineCitationMarkers(once, bundle);
    expect(twice).toBe(once);
  });

  it("escapes regex-special characters in the label", () => {
    const result = injectInlineCitationMarkers("See section (a.b) below", {
      labelByInsightId: { a: "(a.b)" },
      numberByInsightId: { a: 3 },
    });
    expect(result).toBe("See section (a.b) [3] below");
  });

  it("skips labels with no assigned number", () => {
    const result = injectInlineCitationMarkers("Burnout matters", {
      labelByInsightId: { a: "Burnout" },
      numberByInsightId: {}, // no number for "a"
    });
    expect(result).toBe("Burnout matters");
  });

  it("handles multi-occurrence labels by marking every appearance", () => {
    const result = injectInlineCitationMarkers(
      "Burnout. Then more burnout follows.",
      {
        labelByInsightId: { a: "Burnout", b: "burnout" },
        numberByInsightId: { a: 1, b: 1 },
      }
    );
    expect(result).toContain("Burnout [1]");
    expect(result).toContain("burnout [1]");
  });
});

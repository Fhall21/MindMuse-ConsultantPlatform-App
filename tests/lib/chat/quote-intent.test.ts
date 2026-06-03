import { describe, expect, it } from "vitest";
import {
  inferQuotePendingAction,
  wantsAutomaticQuoteExtraction,
} from "@/lib/chat/quote-intent";

describe("quote intent", () => {
  it("defaults extract key quotes to manual review panel", () => {
    expect(inferQuotePendingAction("extract key quotes from chat with Jake")).toBe("show_quotes");
    expect(wantsAutomaticQuoteExtraction("extract key quotes from chat with Jake")).toBe(false);
  });

  it("routes explicit AI extraction to identify_quotes", () => {
    expect(inferQuotePendingAction("identify quotes automatically for this meeting")).toBe(
      "identify_quotes"
    );
    expect(wantsAutomaticQuoteExtraction("AI suggest quotes for me to review")).toBe(true);
  });

  it("treats highlight and review as manual panel", () => {
    expect(inferQuotePendingAction("review quotes for the Jake 1-1")).toBe("show_quotes");
    expect(inferQuotePendingAction("highlight a quote about leadership")).toBe("show_quotes");
  });
});

import { describe, expect, it } from "vitest";
import { collapseDuplicateProse } from "@/lib/chat/dedupe-prose";

describe("collapseDuplicateProse", () => {
  it("removes a verbatim duplicated paragraph block", () => {
    const once = "Guide the user to add their first meeting.";
    expect(collapseDuplicateProse(`${once}${once}`)).toBe(once);
  });

  it("removes duplicate double-newline paragraphs", () => {
    const once = "First sentence.\n\nSecond sentence.";
    expect(collapseDuplicateProse(`${once}\n\n${once}`)).toBe(once);
  });

  it("leaves unique prose unchanged", () => {
    const text = "Saved your meeting. Say when you want themes extracted.";
    expect(collapseDuplicateProse(text)).toBe(text);
  });
});

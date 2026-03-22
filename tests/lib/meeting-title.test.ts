import { describe, it, expect } from "vitest";
import { buildMeetingTitle } from "@/lib/meeting-title";

describe("buildMeetingTitle", () => {
  it("returns empty string when all inputs are empty", () => {
    expect(buildMeetingTitle(null, [], null)).toBe("");
  });

  it("returns code only when only type code provided", () => {
    expect(buildMeetingTitle("FC", [], null)).toBe("FC");
  });

  it("uses first name only for each person", () => {
    expect(buildMeetingTitle(null, ["Alice Smith", "Bob Jones"], null)).toBe("Alice, Bob");
  });

  it("formats date as mon + year", () => {
    const date = new Date("2026-03-15T12:00:00");
    const title = buildMeetingTitle(null, [], date);
    expect(title).toMatch(/Mar 2026/);
  });

  it("combines all three parts with em-dash separator", () => {
    const date = new Date("2026-03-15T12:00:00");
    const title = buildMeetingTitle("1-1", ["Alice Smith", "Bob Jones"], date);
    expect(title).toBe(`1-1 — Alice, Bob — Mar 2026`);
  });

  it("omits missing parts cleanly — code + date only", () => {
    const date = new Date("2026-03-15T12:00:00");
    const title = buildMeetingTitle("FC", [], date);
    expect(title).toBe("FC — Mar 2026");
  });

  it("trims whitespace from code", () => {
    expect(buildMeetingTitle("  FC  ", ["Alice"], null)).toBe("FC — Alice");
  });

  it("ignores empty-string names", () => {
    expect(buildMeetingTitle("FC", ["", "  ", "Bob"], null)).toBe("FC — Bob");
  });
});

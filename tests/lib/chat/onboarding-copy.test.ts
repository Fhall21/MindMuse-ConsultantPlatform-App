import { describe, expect, it } from "vitest";
import {
  CARD_DISMISSED_COPY,
  CARD_REOPEN_HELP,
  meetingSavedDescription,
} from "@/lib/chat/onboarding-copy";

describe("onboarding-copy card success strings", () => {
  it("includes reopen help for collapsed success cards", () => {
    expect(CARD_REOPEN_HELP).toContain("bring the form back");
  });

  it("includes dismissed guidance", () => {
    expect(CARD_DISMISSED_COPY.length).toBeGreaterThan(10);
  });

  it("formats meeting saved description with title", () => {
    expect(meetingSavedDescription("Leadership sync")).toContain("Leadership sync");
  });
});

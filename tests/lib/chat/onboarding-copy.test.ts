import { describe, expect, it } from "vitest";
import {
  CARD_DISMISSED_COPY,
  CARD_REOPEN_HELP,
  getHomeExamplePrompts,
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

  it("uses project-first prompts before any project exists", () => {
    expect(getHomeExamplePrompts("needs_consultation")).toEqual([
      "I want to start processing my first transcript, shall we begin?",
      "Help me set up my first project.",
    ]);
  });

  it("uses transcript intake prompts once a project exists", () => {
    expect(getHomeExamplePrompts("needs_meeting")).toContain(
      "Send a transcript into this project."
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  ASSISTANT_OUTPUT_FALLBACK,
  sanitizeAssistantOutput,
  stripLeakedToolSyntax,
} from "@/lib/chat/assistant-output";

describe("sanitizeAssistantOutput", () => {
  it("keeps normal assistant copy", () => {
    expect(sanitizeAssistantOutput("I found three themes.")).toBe("I found three themes.");
  });

  it("removes leaked fenced tool-call syntax", () => {
    expect(
      sanitizeAssistantOutput(
        "Working on that.\n\n```extract_themes to=functions.extract_themes\n{\"meeting_id\":\"123\"}\n```"
      )
    ).toBe("Working on that.");
  });

  it("returns safe fallback when leaked tool-call syntax is the whole response", () => {
    expect(
      sanitizeAssistantOutput(
        "extract_themes to=functions.extract_themes\n{\"meeting_id\":\"123\"}"
      )
    ).toBe(ASSISTANT_OUTPUT_FALLBACK);
  });

  it("hides leaked syntax while a valid tool card may still be streaming", () => {
    expect(
      stripLeakedToolSyntax(
        "extract_themes to=functions.extract_themes\n{\"meeting_id\":\"123\"}"
      )
    ).toBe("");
  });
});

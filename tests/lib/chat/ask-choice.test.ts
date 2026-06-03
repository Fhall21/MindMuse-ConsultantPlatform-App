import { describe, expect, it } from "vitest";
import {
  ASK_CHOICE_REPLY_PREFIX,
  askChoiceCardTitle,
  formatChoiceAnswers,
  isAskChoiceUserReply,
  readAskChoiceContext,
} from "@/lib/chat/tools/ask-choice";

describe("lib/chat/tools/ask-choice", () => {
  it("formats answers with prefix and question lines for a single question", () => {
    const text = formatChoiceAnswers(
      [
        {
          id: "q1",
          question: "Which meeting?",
          mode: "single",
          options: ["July", "August"],
          purpose: "disambiguate",
        },
      ],
      new Map([["q1", ["July"]]]),
      "Meeting for theme extract"
    );

    expect(text).toContain(`${ASK_CHOICE_REPLY_PREFIX} Meeting for theme extract`);
    expect(text).toContain("1. Which meeting?");
    expect(text).toContain("→ July");
  });

  it("detects ask-choice user replies", () => {
    expect(isAskChoiceUserReply("[User choice]\n1. Proceed?\n   → Yes")).toBe(true);
    expect(isAskChoiceUserReply("plain user text")).toBe(false);
  });

  it("reads optional context from tool output", () => {
    expect(
      readAskChoiceContext({ questions: [], context: "Confirm next step" })
    ).toBe("Confirm next step");
    expect(readAskChoiceContext({ questions: [] })).toBeNull();
  });

  it("picks confirm title for single confirm purpose", () => {
    expect(
      askChoiceCardTitle([
        {
          id: "q1",
          question: "Group themes now?",
          mode: "single",
          options: ["Yes", "No"],
          purpose: "confirm",
        },
      ])
    ).toBe("Confirm");
  });
});

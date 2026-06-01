import { describe, expect, it } from "vitest";
import {
  CHAT_CARD_TOOL_NAMES,
  isChatCardToolName,
  messageContentIsCardTool,
  sessionTurnIncludesCardTool,
} from "@/lib/chat/card-tools";

describe("lib/chat/card-tools", () => {
  it("includes all mapped card tools", () => {
    expect(CHAT_CARD_TOOL_NAMES.has("intake_text_transcript")).toBe(true);
    expect(CHAT_CARD_TOOL_NAMES.has("extract_themes")).toBe(true);
    expect(CHAT_CARD_TOOL_NAMES.has("identify_quotes")).toBe(true);
    expect(CHAT_CARD_TOOL_NAMES.has("generate_clarification")).toBe(true);
    expect(isChatCardToolName("confirm_meeting")).toBe(false);
  });

  it("detects card tool messages in a turn", async () => {
    const content = JSON.stringify({
      tool: "extract_themes",
      input: { meeting_id: "11111111-1111-4111-8111-111111111111" },
      status: "pending",
    });

    expect(messageContentIsCardTool(content)).toBe(true);
    await expect(
      sessionTurnIncludesCardTool([
        { role: "user", content: "Extract themes" },
        { role: "tool", content },
      ])
    ).resolves.toBe(true);
    await expect(
      sessionTurnIncludesCardTool([{ role: "assistant", content: "Here are themes..." }])
    ).resolves.toBe(false);
  });

  it("ignores card tools from prior turns when checking prose suppression", async () => {
    const priorCard = JSON.stringify({
      tool: "extract_themes",
      input: { meeting_id: "11111111-1111-4111-8111-111111111111" },
      status: "success",
    });

    await expect(
      sessionTurnIncludesCardTool([
        { role: "user", content: "Extract themes" },
        { role: "tool", content: priorCard },
        { role: "assistant", content: "Themes are ready for review." },
        { role: "user", content: "What should I do next?" },
        { role: "assistant", content: "Review the themes card above." },
      ])
    ).resolves.toBe(false);
  });
});

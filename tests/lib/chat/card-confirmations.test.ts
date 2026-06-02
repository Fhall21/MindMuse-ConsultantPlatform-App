import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  insertOwnedCardConfirmation,
} from "@/lib/chat/card-confirmations";
import { getCardConfirmationMessage } from "@/lib/chat/card-confirmation-copy";

const getUnarchivedSessionForUser = vi.fn();
const getToolResultForSession = vi.fn();
const insertChatMessage = vi.fn();
const updateToolResult = vi.fn();

vi.mock("@/lib/chat/context", () => ({
  getUnarchivedSessionForUser: (...args: unknown[]) => getUnarchivedSessionForUser(...args),
}));

vi.mock("@/lib/chat/persist", () => ({
  getToolResultForSession: (...args: unknown[]) => getToolResultForSession(...args),
  insertChatMessage: (...args: unknown[]) => insertChatMessage(...args),
  updateToolResult: (...args: unknown[]) => updateToolResult(...args),
}));

describe("card confirmations", () => {
  beforeEach(() => {
    getUnarchivedSessionForUser.mockReset();
    getToolResultForSession.mockReset();
    insertChatMessage.mockReset();
    updateToolResult.mockReset();
  });

  it("marks an owned direct-write tool result as success before replying", async () => {
    getUnarchivedSessionForUser.mockResolvedValue({ id: "session-1" });
    getToolResultForSession.mockResolvedValue({
      id: "tool-result-1",
      output: { insight_id: "insight-1", label: "Priority disruption" },
    });

    await expect(
      insertOwnedCardConfirmation({
        userId: "user-1",
        sessionId: "session-1",
        toolResultId: "tool-result-1",
        action: "theme_updated",
      })
    ).resolves.toBe(true);

    expect(updateToolResult).toHaveBeenCalledWith({
      toolResultId: "tool-result-1",
      sessionId: "session-1",
      output: { insight_id: "insight-1", label: "Priority disruption" },
      status: "success",
    });
  });

  it("inserts fixed assistant copy into an owned session", async () => {
    getUnarchivedSessionForUser.mockResolvedValue({ id: "session-1" });

    await expect(
      insertOwnedCardConfirmation({
        userId: "user-1",
        sessionId: "session-1",
        action: "theme_updated",
      })
    ).resolves.toBe(true);

    expect(getUnarchivedSessionForUser).toHaveBeenCalledWith("user-1", "session-1");
    expect(insertChatMessage).toHaveBeenCalledWith({
      sessionId: "session-1",
      role: "assistant",
      content: getCardConfirmationMessage("theme_updated"),
    });
  });

  it("does not write into a missing or unowned session", async () => {
    getUnarchivedSessionForUser.mockResolvedValue(null);

    await expect(
      insertOwnedCardConfirmation({
        userId: "user-1",
        sessionId: "other-session",
        action: "meeting_updated",
      })
    ).resolves.toBe(false);

    expect(insertChatMessage).not.toHaveBeenCalled();
  });
});

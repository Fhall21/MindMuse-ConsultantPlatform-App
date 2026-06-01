import { describe, expect, it } from "vitest";
import { dbMessagesToUiMessages } from "@/lib/chat/ui-messages";

describe("lib/chat/ui-messages", () => {
  it("maps persisted tool rows to MeetingConfirmationCard metadata", () => {
    const toolMessageId = "msg-tool-1";
    const toolResultId = "result-1";

    const messages = dbMessagesToUiMessages(
      [
        {
          id: "msg-user-1",
          sessionId: "session-1",
          role: "user",
          content: "I uploaded a consultation transcript file (`session.vtt`).",
          toolCallId: null,
          createdAt: new Date("2026-06-01T10:00:00.000Z"),
        },
        {
          id: toolMessageId,
          sessionId: "session-1",
          role: "tool",
          content: JSON.stringify({
            tool: "intake_text_transcript",
            input: { text: "Speaker one said hello." },
            output: {
              title: "Session",
              date: "2026-06-01T12:00:00.000Z",
              participants: ["Speaker one"],
              notes_preview: "Speaker one said hello.",
              intake_kind: "transcript",
            },
            status: "pending",
            toolResultId,
          }),
          toolCallId: "intake_text_transcript",
          createdAt: new Date("2026-06-01T10:00:01.000Z"),
        },
      ],
      [
        {
          id: toolResultId,
          sessionId: "session-1",
          messageId: toolMessageId,
          toolName: "intake_text_transcript",
          input: { text: "Speaker one said hello." },
          output: {
            title: "Session",
            date: "2026-06-01T12:00:00.000Z",
            participants: ["Speaker one"],
            notes_preview: "Speaker one said hello.",
            intake_kind: "transcript",
          },
          status: "pending",
          createdAt: new Date("2026-06-01T10:00:01.000Z"),
        },
      ]
    );

    const cardMessage = messages.find(
      (message) =>
        (message.metadata as { chatTool?: { toolName?: string } } | undefined)?.chatTool
          ?.toolName === "intake_text_transcript"
    );

    expect(cardMessage?.role).toBe("assistant");
    expect(cardMessage?.metadata).toEqual({
      chatTool: {
        toolName: "intake_text_transcript",
        input: { text: "Speaker one said hello." },
        output: {
          title: "Session",
          date: "2026-06-01T12:00:00.000Z",
          participants: ["Speaker one"],
          notes_preview: "Speaker one said hello.",
          intake_kind: "transcript",
        },
        status: "pending",
        toolResultId,
      },
    });
  });
});

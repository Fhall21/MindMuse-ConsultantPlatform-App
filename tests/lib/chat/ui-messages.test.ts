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
          seenAt: null,
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

  it("maps extract_themes output to ThemeReviewCard metadata", () => {
    const toolMessageId = "msg-theme-1";
    const toolResultId = "result-theme-1";
    const meetingId = "11111111-1111-4111-8111-111111111111";
    const themeId = "22222222-2222-4222-8222-222222222222";

    const messages = dbMessagesToUiMessages(
      [
        {
          id: toolMessageId,
          sessionId: "session-1",
          role: "tool",
          content: JSON.stringify({
            tool: "extract_themes",
            input: { meeting_id: meetingId },
            output: {
              meeting_id: meetingId,
              themes: [
                {
                  id: themeId,
                  label: "Workload",
                  description: "Pressure on team capacity",
                  source_quotes: [],
                  confidence: 0.8,
                },
              ],
              decisions: {},
            },
            status: "pending",
            toolResultId,
          }),
          toolCallId: "extract_themes",
          createdAt: new Date("2026-06-01T10:00:01.000Z"),
        },
      ],
      [
        {
          id: toolResultId,
          sessionId: "session-1",
          messageId: toolMessageId,
          toolName: "extract_themes",
          input: { meeting_id: meetingId },
          output: {
            meeting_id: meetingId,
            themes: [
              {
                id: themeId,
                label: "Workload",
                description: "Pressure on team capacity",
                source_quotes: [],
                confidence: 0.8,
              },
            ],
            decisions: {},
          },
          status: "pending",
          seenAt: null,
          createdAt: new Date("2026-06-01T10:00:01.000Z"),
        },
      ]
    );

    const cardMessage = messages[0];
    expect(
      (cardMessage.metadata as { chatTool?: { toolName?: string } }).chatTool?.toolName
    ).toBe("extract_themes");
    expect(
      (cardMessage.metadata as { chatTool?: { status?: string } }).chatTool?.status
    ).toBe("pending");
  });

  it("maps generate_clarification output to ClarificationQuestionCard metadata", () => {
    const messages = dbMessagesToUiMessages([
      {
        id: "msg-clarify-1",
        sessionId: "session-1",
        role: "tool",
        content: JSON.stringify({
          tool: "generate_clarification",
          input: {
            notes_text: "Ambiguous notes",
            meeting_id: "11111111-1111-4111-8111-111111111111",
          },
          output: {
            questions: [
              {
                id: "q-1",
                question: "Was follow-up agreed?",
                field: "follow_up",
              },
            ],
          },
          status: "pending",
        }),
        toolCallId: "generate_clarification",
        createdAt: new Date("2026-06-01T10:00:01.000Z"),
      },
    ]);

    expect(
      (messages[0].metadata as { chatTool?: { toolName?: string } }).chatTool?.toolName
    ).toBe("generate_clarification");
  });

  it("keeps MeetingConfirmationCard metadata after success output shape", () => {
    const toolMessageId = "msg-tool-success";
    const toolResultId = "result-success";

    const messages = dbMessagesToUiMessages(
      [
        {
          id: toolMessageId,
          sessionId: "session-1",
          role: "tool",
          content: JSON.stringify({
            tool: "intake_text_transcript",
            input: { text: "Speaker one said hello." },
            status: "success",
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
            meeting_draft: {
              title: "Leadership sync",
              date: "2026-06-01T12:00:00.000Z",
              participants: ["Alex Chen"],
              intake_kind: "transcript",
            },
            meeting_record: {
              id: "33333333-3333-4333-8333-333333333333",
              title: "Leadership sync",
            },
          },
          status: "success",
          seenAt: null,
          createdAt: new Date("2026-06-01T10:00:02.000Z"),
        },
      ]
    );

    const cardMessage = messages[0];
    expect(
      (cardMessage.metadata as { chatTool?: { status?: string } }).chatTool?.status
    ).toBe("success");
    expect(
      (
        (cardMessage.metadata as { chatTool?: { output?: { meeting_draft?: { title?: string } } } })
          .chatTool?.output as { meeting_draft?: { title?: string } }
      )?.meeting_draft?.title
    ).toBe("Leadership sync");
  });
});

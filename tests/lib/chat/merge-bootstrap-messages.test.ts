import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { mergeBootstrapWithStreamingAssistant } from "@/lib/chat/merge-bootstrap-messages";

describe("lib/chat/merge-bootstrap-messages", () => {
  it("keeps streamed assistant prose missing from bootstrap reload", () => {
    const streaming: UIMessage[] = [
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
      },
      {
        id: "assistant-stream",
        role: "assistant",
        parts: [{ type: "text", text: "Hi there — how can I help?" }],
      },
    ];

    const bootstrap: UIMessage[] = [
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
      },
    ];

    const merged = mergeBootstrapWithStreamingAssistant(streaming, bootstrap);
    expect(merged).toHaveLength(2);
    expect(merged[1]?.parts[0]).toEqual({
      type: "text",
      text: "Hi there — how can I help?",
    });
  });

  it("does not duplicate assistant prose already present in bootstrap", () => {
    const text = "Hi there — how can I help?";
    const streaming: UIMessage[] = [
      {
        id: "assistant-stream",
        role: "assistant",
        parts: [{ type: "text", text }],
      },
    ];
    const bootstrap: UIMessage[] = [
      {
        id: "assistant-db",
        role: "assistant",
        parts: [{ type: "text", text }],
      },
    ];

    expect(mergeBootstrapWithStreamingAssistant(streaming, bootstrap)).toEqual(bootstrap);
  });

  it("does not append streamed prose contained in bootstrap after dedupe", () => {
    const once = "Guide the user to add their first meeting.";
    const streaming: UIMessage[] = [
      {
        id: "assistant-stream",
        role: "assistant",
        parts: [{ type: "text", text: `${once}${once}` }],
      },
    ];
    const bootstrap: UIMessage[] = [
      {
        id: "assistant-db",
        role: "assistant",
        parts: [{ type: "text", text: once }],
      },
    ];

    expect(mergeBootstrapWithStreamingAssistant(streaming, bootstrap)).toEqual(bootstrap);
  });
});

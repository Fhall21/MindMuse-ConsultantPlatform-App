import { describe, expect, it } from "vitest";
import { formatDigitalInterviewFramework, responseToTranscript } from "@/lib/digital-interviews";

describe("responseToTranscript", () => {
  it("keeps only user turns", () => {
    expect(
      responseToTranscript({
        conversationHistory: [
          { role: "assistant", content: "Hello", timestamp: "2026-04-23T10:00:00.000Z" },
          { role: "user", content: "First answer", timestamp: "2026-04-23T10:01:00.000Z" },
          { role: "assistant", content: "Follow-up", timestamp: "2026-04-23T10:02:00.000Z" },
          { role: "user", content: "Second answer", timestamp: "2026-04-23T10:03:00.000Z" },
        ],
      } as never)
    ).toBe("First answer\n\nSecond answer");
  });
});

describe("formatDigitalInterviewFramework", () => {
  it("formats framework labels", () => {
    expect(formatDigitalInterviewFramework("appreciative_inquiry")).toBe("Appreciative Inquiry");
    expect(formatDigitalInterviewFramework("psychological_safety")).toBe("Psychological Safety");
    expect(formatDigitalInterviewFramework("custom")).toBe("Custom");
  });
});

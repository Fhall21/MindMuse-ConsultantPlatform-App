import { describe, expect, it } from "vitest";
import {
  DIGITAL_INTERVIEW_FRAMEWORK_LABELS,
  formatDigitalInterviewFramework,
  responseToTranscript,
} from "@/lib/digital-interviews";
import { DIGITAL_INTERVIEW_FRAMEWORKS } from "@/lib/digital-interview-frameworks";

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
    for (const framework of DIGITAL_INTERVIEW_FRAMEWORKS) {
      expect(formatDigitalInterviewFramework(framework.id)).toBe(framework.label);
      expect(DIGITAL_INTERVIEW_FRAMEWORK_LABELS[framework.id]).toBe(framework.label);
    }

    expect(formatDigitalInterviewFramework("custom")).toBe("Custom");
  });
});

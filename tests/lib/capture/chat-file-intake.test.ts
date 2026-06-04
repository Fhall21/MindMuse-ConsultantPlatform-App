import { describe, expect, it } from "vitest";
import { buildChatIntakeUserMessage, buildUploadAckUserMessage } from "@/lib/capture/chat-file-intake";
import { isAudioFile } from "@/lib/capture/audio-transcribe";
import { isNotesImageFile } from "@/lib/capture/ocr-image";

describe("lib/capture/chat-file-intake", () => {
  it("builds short upload ack without transcript body", () => {
    const message = buildUploadAckUserMessage({
      intakeKind: "transcript",
      fileName: "session.vtt",
    });

    expect(message).toContain("project transcript file");
    expect(message).toContain("session.vtt");
    expect(message).not.toContain("---");
  });

  it("builds intake message with consultation copy and tool hint", () => {
    const message = buildChatIntakeUserMessage({
      intakeKind: "transcript",
      fileName: "session.vtt",
      text: "Speaker one said hello.",
      projectId: "11111111-1111-4111-8111-111111111111",
    });

    expect(message).toContain("project transcript file");
    expect(message).toContain("intake_text_transcript");
    expect(message).toContain("11111111-1111-4111-8111-111111111111");
    expect(message).toContain("Speaker one said hello.");
  });

  it("prompts for project selection when project id missing", () => {
    const message = buildChatIntakeUserMessage({
      intakeKind: "notes",
      fileName: "notes.jpg",
      text: "Action items",
    });

    expect(message).toContain("intake_notes");
    expect(message).toContain("create or choose one");
  });
});

describe("lib/capture/file kind detection", () => {
  it("detects audio mime types", () => {
    expect(isAudioFile({ type: "audio/mpeg", name: "x.mp3" } as File)).toBe(true);
    expect(isAudioFile({ type: "", name: "recording.m4a" } as File)).toBe(true);
    expect(isAudioFile({ type: "text/plain", name: "x.txt" } as File)).toBe(false);
  });

  it("detects notes image files", () => {
    expect(isNotesImageFile({ type: "image/png", name: "page.png" } as File)).toBe(true);
    expect(isNotesImageFile({ type: "", name: "scan.HEIC" } as File)).toBe(true);
  });
});

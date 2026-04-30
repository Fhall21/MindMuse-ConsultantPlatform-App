// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TranscriptEditor } from "@/components/consultations/transcript-editor";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockInvalidateQueries = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

vi.mock("@/lib/actions/consultations", () => ({
  updateTranscript: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TranscriptEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("save button is disabled when content matches initial value", () => {
    render(
      <TranscriptEditor meetingId="meeting-1" initialValue="initial transcript" />
    );
    expect(screen.getByRole("button", { name: "Save transcript" })).toBeDisabled();
  });

  it("save button enables when textarea content changes (simulates paste via onChange)", () => {
    render(
      <TranscriptEditor meetingId="meeting-1" initialValue="initial transcript" />
    );
    fireEvent.change(screen.getByPlaceholderText(/paste or type/i), {
      target: { value: "pasted content here" },
    });
    expect(screen.getByRole("button", { name: "Save transcript" })).not.toBeDisabled();
  });

  it("calls onDirtyChange(true) when content diverges from initial value", () => {
    const onDirtyChange = vi.fn();
    render(
      <TranscriptEditor
        meetingId="meeting-1"
        initialValue="initial transcript"
        onDirtyChange={onDirtyChange}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/paste or type/i), {
      target: { value: "pasted content here" },
    });
    expect(onDirtyChange).toHaveBeenCalledWith(true);
  });

  it("calls onDirtyChange(false) after successful save clears dirty state", async () => {
    const onDirtyChange = vi.fn();
    render(
      <TranscriptEditor
        meetingId="meeting-1"
        initialValue="initial transcript"
        onDirtyChange={onDirtyChange}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/paste or type/i), {
      target: { value: "pasted content here" },
    });
    // Dirty now — last call should be true
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Save transcript" }));

    // After save resolves, isDirty = false → onDirtyChange(false)
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });

  it("invalidates meetings, themes, and meeting-report query keys after save", async () => {
    render(
      <TranscriptEditor meetingId="meeting-1" initialValue="initial transcript" />
    );
    fireEvent.change(screen.getByPlaceholderText(/paste or type/i), {
      target: { value: "new transcript content" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save transcript" }));

    await waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["meetings", "meeting-1"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["themes", "meeting", "meeting-1"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["meeting-report", "meeting-1"],
      });
    });
  });
});

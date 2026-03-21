// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectionTypePrompt } from "@/components/canvas/connection-type-prompt";

describe("ConnectionTypePrompt", () => {
  it("saves selected type and note with keyboard shortcut", () => {
    const onSave = vi.fn();

    render(
      <ConnectionTypePrompt
        sourceLabel="Fatigue complaints"
        targetLabel="Supervision gaps"
        onSave={onSave}
        onDismiss={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Why does this relationship matter?"), {
      target: { value: "Strong directional effect" },
    });

    fireEvent.keyDown(window, { key: "1" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(onSave).toHaveBeenCalledWith({
      type: "causes",
      note: "Strong directional effect",
    });
  });

  it("uses provided position and supports cancel by escape", () => {
    const onDismiss = vi.fn();

    render(
      <ConnectionTypePrompt
        sourceLabel="Node A"
        targetLabel="Node B"
        position={{ x: 240, y: 180 }}
        onSave={vi.fn()}
        onDismiss={onDismiss}
      />
    );

    const prompt = screen.getByTestId("connection-type-prompt");

    expect(prompt).toHaveStyle({ left: "90px", top: "192px" });

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CanvasFrameBar } from "@/components/canvas/canvas-frame-bar";
import type { CanvasFrame } from "@/types/canvas";

function makeFrame(overrides: Partial<CanvasFrame> = {}): CanvasFrame {
  return {
    id: "frame-1",
    consultation_id: "consultation-1",
    name: "Wellbeing cluster",
    x: 0,
    y: 0,
    width: 600,
    height: 400,
    color: "blue",
    node_ids: ["node-a", "node-b"],
    viewport: { x: 0, y: 0, zoom: 1 },
    position: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const defaultProps = {
  frames: [] as CanvasFrame[],
  activeFrameId: null as string | null,
  drawingMode: false as boolean,
  exporting: false as boolean,
  onSelectFrame: vi.fn(),
  onRenameFrame: vi.fn(),
  onDeleteFrame: vi.fn(),
  onToggleDrawingMode: undefined as (() => void) | undefined,
  onExportImages: undefined as (() => void) | undefined,
  disabled: false as boolean,
};

function renderBar(props: Partial<typeof defaultProps> = {}) {
  return render(
    <TooltipProvider>
      <CanvasFrameBar {...defaultProps} {...props} />
    </TooltipProvider>
  );
}

describe("CanvasFrameBar", () => {
  it("renders All tab", () => {
    renderBar();
    expect(screen.getByRole("tab", { name: /all/i })).toBeInTheDocument();
  });

  it("All tab is active when activeFrameId is null", () => {
    renderBar({ activeFrameId: null });
    const allTab = screen.getByRole("tab", { name: /all/i });
    expect(allTab).toHaveAttribute("aria-selected", "true");
  });

  it("renders frame tabs for each frame", () => {
    const frames = [
      makeFrame({ id: "f1", name: "Frame One" }),
      makeFrame({ id: "f2", name: "Frame Two" }),
    ];
    renderBar({ frames });
    expect(screen.getByRole("tab", { name: /frame one/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /frame two/i })).toBeInTheDocument();
  });

  it("calls onSelectFrame(null) when All is clicked", () => {
    const onSelectFrame = vi.fn();
    const frames = [makeFrame()];
    renderBar({ frames, activeFrameId: "frame-1", onSelectFrame });
    fireEvent.click(screen.getByRole("tab", { name: /all/i }));
    expect(onSelectFrame).toHaveBeenCalledWith(null);
  });

  it("calls onSelectFrame(frameId) when a frame tab is clicked", () => {
    const onSelectFrame = vi.fn();
    const frames = [makeFrame({ id: "f1", name: "Focus Group" })];
    renderBar({ frames, onSelectFrame });
    fireEvent.click(screen.getByRole("tab", { name: /focus group/i }));
    expect(onSelectFrame).toHaveBeenCalledWith("f1");
  });

  it("marks the active frame tab as selected", () => {
    const frames = [makeFrame({ id: "f1", name: "Active Frame" })];
    renderBar({ frames, activeFrameId: "f1" });
    const tab = screen.getByRole("tab", { name: /active frame/i });
    expect(tab).toHaveAttribute("aria-selected", "true");
  });

  it("All tab shows frame count badge when frames exist", () => {
    const frames = [makeFrame(), makeFrame({ id: "f2", name: "Second" })];
    renderBar({ frames });
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("does not show badge when no frames", () => {
    renderBar({ frames: [] });
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("calls onDeleteFrame when delete button is clicked", () => {
    const onDeleteFrame = vi.fn();
    const frames = [makeFrame({ id: "f1", name: "To Delete" })];
    renderBar({ frames, onDeleteFrame });
    const deleteBtn = screen.getByRole("button", { name: /delete frame "to delete"/i });
    fireEvent.click(deleteBtn);
    expect(onDeleteFrame).toHaveBeenCalledWith("f1");
  });

  it("renders the Draw frame button when onToggleDrawingMode is wired", () => {
    const onToggleDrawingMode = vi.fn();
    renderBar({ onToggleDrawingMode });
    expect(screen.getByRole("button", { name: /draw frame/i })).toBeInTheDocument();
  });

  it("does not render the Draw button when no toggle handler is supplied", () => {
    renderBar();
    expect(screen.queryByRole("button", { name: /draw frame/i })).not.toBeInTheDocument();
  });

  it("calls onToggleDrawingMode when Draw button clicked", () => {
    const onToggleDrawingMode = vi.fn();
    renderBar({ onToggleDrawingMode });
    fireEvent.click(screen.getByRole("button", { name: /draw frame/i }));
    expect(onToggleDrawingMode).toHaveBeenCalledTimes(1);
  });

  it("renders Drawing… label when drawingMode is true", () => {
    const onToggleDrawingMode = vi.fn();
    renderBar({ onToggleDrawingMode, drawingMode: true });
    expect(screen.getByRole("button", { name: /drawing…/i })).toBeInTheDocument();
  });

  it("does not call onSelectFrame when disabled", () => {
    const onSelectFrame = vi.fn();
    renderBar({ disabled: true, onSelectFrame });
    const allTab = screen.getByRole("tab", { name: /all/i });
    expect(allTab).toBeDisabled();
  });
});

describe("CanvasFrameBar inline rename", () => {
  it("shows input on double-click of frame tab", () => {
    const frames = [makeFrame({ id: "f1", name: "Rename Me" })];
    renderBar({ frames });
    fireEvent.dblClick(screen.getByRole("tab", { name: /rename me/i }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("calls onRenameFrame on blur with new name", () => {
    const onRenameFrame = vi.fn();
    const frames = [makeFrame({ id: "f1", name: "Old Name" })];
    renderBar({ frames, onRenameFrame });
    fireEvent.dblClick(screen.getByRole("tab", { name: /old name/i }));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "New Name" } });
    fireEvent.blur(input);
    expect(onRenameFrame).toHaveBeenCalledWith("f1", "New Name");
  });

  it("cancels edit on Escape", () => {
    const onRenameFrame = vi.fn();
    const frames = [makeFrame({ id: "f1", name: "Unchanged" })];
    renderBar({ frames, onRenameFrame });
    fireEvent.dblClick(screen.getByRole("tab", { name: /unchanged/i }));
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onRenameFrame).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

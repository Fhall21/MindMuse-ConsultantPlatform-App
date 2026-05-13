// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReasoningSteps } from "@/components/research/reasoning-steps";

describe("ReasoningSteps", () => {
  it("renders planning content as a structured checklist", () => {
    render(
      <ReasoningSteps
        steps={[
          {
            label: "Planning research",
            detail: "",
            content: "✓ Define scope\n→ Build search terms\n○ Capture evidence",
          },
        ]}
      />
    );

    expect(screen.getByText("Define scope")).toBeInTheDocument();
    expect(screen.getByText("Build search terms")).toBeInTheDocument();
    expect(screen.getByText("Capture evidence")).toBeInTheDocument();
  });

  it("renders search steps as separated query result blocks", () => {
    render(
      <ReasoningSteps
        steps={[
          {
            label: "Searching literature",
            detail: "",
            content: "shift work burnout → 3 papers found\nnight shifts and fatigue → 5 papers found",
          },
        ]}
      />
    );

    expect(screen.getByText("shift work burnout")).toBeInTheDocument();
    expect(screen.getByText("3 papers found")).toBeInTheDocument();
    expect(screen.getByText("night shifts and fatigue")).toBeInTheDocument();
    expect(screen.getByText("5 papers found")).toBeInTheDocument();
  });

  it("renders plain text as spaced paragraphs and markdown tables as tables", () => {
    const { rerender } = render(
      <ReasoningSteps
        steps={[
          {
            label: "Writing answer",
            detail: "",
            content: "First paragraph about the evidence.\n\nSecond paragraph with the synthesis.",
          },
        ]}
      />
    );

    expect(screen.getByText(/First paragraph/)).toBeInTheDocument();
    expect(screen.getByText(/Second paragraph/)).toBeInTheDocument();

    rerender(
      <ReasoningSteps
        steps={[
          {
            label: "Synthesising findings",
            detail: "",
            content: "| Method | Use |\n|---|---|\n| Interview | Context |\n| Survey | Breadth |",
          },
        ]}
      />
    );

    expect(screen.getByText("Method")).toBeInTheDocument();
    expect(screen.getByText("Use")).toBeInTheDocument();
    expect(screen.getByText("Interview")).toBeInTheDocument();
    expect(screen.getByText("Survey")).toBeInTheDocument();
  });
});
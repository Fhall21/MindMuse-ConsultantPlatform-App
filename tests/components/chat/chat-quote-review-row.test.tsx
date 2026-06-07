// @vitest-environment jsdom

import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatQuoteReviewRow } from "@/components/quotes/chat-quote-review-row";

const baseProps = {
  text: "The handoff kept moving between different tools.",
  speaker: "Analyst",
  positionLabel: "00:42",
  themeLabel: "Tool handoff friction",
  justification: "Shows where the current workflow loses continuity.",
  contextBefore: "Before the change, ",
  contextAfter: " and the team lost time.",
};

describe("ChatQuoteReviewRow", () => {
  it("renders the meeting quote-card content hierarchy", () => {
    const { container } = render(<ChatQuoteReviewRow {...baseProps} />);

    expect(screen.getByText("Analyst")).toBeInTheDocument();
    expect(screen.getByText(baseProps.text).closest("blockquote")).toHaveTextContent(
      `${baseProps.contextBefore}${baseProps.text}${baseProps.contextAfter}`
    );
    expect(screen.getByText(baseProps.text)).toHaveClass("bg-amber-200");
    expect(screen.getByText(baseProps.justification)).toHaveClass("border-t");
    expect(screen.getByText("00:42 · AI suggested")).toBeInTheDocument();
    expect(screen.getByText("Tool handoff friction")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("rounded-md", "p-3");
  });

  it("preserves chat actions and busy state", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    const onDismiss = vi.fn();

    const { rerender } = render(
      <ChatQuoteReviewRow
        {...baseProps}
        onAccept={onAccept}
        onDismiss={onDismiss}
      />
    );

    await user.click(screen.getByRole("button", { name: "Accept" }));
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onAccept).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();

    rerender(
      <ChatQuoteReviewRow
        {...baseProps}
        isBusy
        onAccept={onAccept}
        onDismiss={onDismiss}
      />
    );
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeDisabled();
  });

  it("renders accepted, dismissed, fallback, and error states", () => {
    const { rerender } = render(
      <ChatQuoteReviewRow {...baseProps} decision="accepted" />
    );

    expect(screen.getByText(baseProps.text)).toHaveClass("bg-green-200");
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(
      <ChatQuoteReviewRow
        {...baseProps}
        speaker={null}
        decision="dismissed"
        error="Could not update quote"
      />
    );

    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByText(baseProps.text)).toHaveClass("bg-muted");
    expect(screen.getByText("Dismissed")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not update quote");
  });
});

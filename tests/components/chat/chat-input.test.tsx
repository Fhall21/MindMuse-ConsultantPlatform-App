// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatInput } from "@/components/chat/ChatInput";

const defaultProps = {
  value: "",
  onChange: vi.fn(),
  onSubmit: vi.fn(),
};

describe("ChatInput", () => {
  it("routes dropped files through transcript intake", () => {
    const onAttachFile = vi.fn();
    const file = new File(["Speaker: hello"], "session.vtt", {
      type: "text/vtt",
    });

    render(<ChatInput {...defaultProps} onAttachFile={onAttachFile} />);

    fireEvent.drop(screen.getByRole("textbox"), {
      dataTransfer: {
        files: [file],
        types: ["Files"],
        dropEffect: "copy",
      },
    });

    expect(onAttachFile).toHaveBeenCalledWith(file, "transcript");
  });

  it("uses send wording for transcript selection", () => {
    render(<ChatInput {...defaultProps} onAttachFile={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Send transcript" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /attach project transcript/i })
    ).not.toBeInTheDocument();
  });
});

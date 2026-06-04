// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatHomeView } from "@/components/chat/ChatHomeView";

vi.mock("@/components/chat/cards/CreateProjectCard", () => ({
  CreateProjectCard: () => <div>Create your first project</div>,
}));

vi.mock("@/components/chat/cards/ProjectSelectionCard", () => ({
  ProjectSelectionCard: () => <div>Choose a project</div>,
}));

const defaultProps = {
  displayName: "Felix",
  welcomeVariant: "brand_new" as const,
  onboardingPhase: "needs_consultation" as const,
  sessions: [],
  activeSessionId: null,
  onSelectSession: vi.fn(),
  input: "",
  onInputChange: vi.fn(),
  onSend: vi.fn(),
  isBusy: false,
};

describe("ChatHomeView", () => {
  it("shows first-project creation without the composer", () => {
    render(<ChatHomeView {...defaultProps} showCreateProject />);

    expect(screen.getByText("Create your first project")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("uses stage-aware prompts when a project is ready for transcript intake", () => {
    render(
      <ChatHomeView
        {...defaultProps}
        welcomeVariant="resume_onboarding"
        onboardingPhase="needs_meeting"
      />
    );

    expect(
      screen.getByRole("button", { name: "Send a transcript into this project." })
    ).toBeInTheDocument();
  });
});

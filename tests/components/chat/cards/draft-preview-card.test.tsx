// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CardConfirmProvider } from "@/components/chat/card-confirm-context";
import { DraftPreviewCard } from "@/components/chat/cards/DraftPreviewCard";
import type { ChatToolMessageMeta } from "@/lib/chat/ui-messages";

vi.mock("@/hooks/use-ai-preferences", () => ({
  useAIPreferences: () => ({
    data: {
      consultationTypes: [],
      focusAreas: [],
      industry: "",
      excludedTopics: [],
      emailGuidance: "",
      anonymousMode: true,
    },
    isPending: false,
  }),
  useUpdateAIPreferences: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

function renderCard(output: Record<string, unknown>) {
  const tool: ChatToolMessageMeta = {
    toolName: "draft_evidence_email",
    input: {},
    output,
    status: "pending",
    toolResultId: "11111111-1111-4111-8111-111111111111",
  };

  return render(
    <CardConfirmProvider>
      <DraftPreviewCard
        tool={tool}
        messageId="message-1"
        sessionId="22222222-2222-4222-8222-222222222222"
      />
    </CardConfirmProvider>
  );
}

const baseOutput = {
  consultation_id: "33333333-3333-4333-8333-333333333333",
  meeting_id: "44444444-4444-4444-8444-444444444444",
  draft_id: "55555555-5555-4555-8555-555555555555",
  subject: "Follow-up subject",
  body: "Hi Jake,\n\nThanks for speaking with me.",
  supporting_quotes: [{ id: "q1", text: "Hidden supporting quote" }],
  linked_themes: [],
};

describe("DraftPreviewCard", () => {
  it("renders initial evidence email without guidance, edit UI, or supporting quotes", () => {
    renderCard(baseOutput);

    expect(screen.getByText("Follow-up subject")).toBeInTheDocument();
    expect(screen.getByText(/Thanks for speaking with me/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeInTheDocument();
    expect(screen.queryByText("Evidence email guidance")).not.toBeInTheDocument();
    expect(screen.queryByText("Supporting quotes")).not.toBeInTheDocument();
    expect(screen.queryByText("Hidden supporting quote")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("renders revision requests as guidance-only card", () => {
    renderCard({
      ...baseOutput,
      revision_request: "make the email shorter",
    });

    expect(screen.getAllByText("Evidence email guidance").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Save guidance" })).toBeInTheDocument();
    expect(screen.queryByText("Follow-up subject")).not.toBeInTheDocument();
    expect(screen.queryByText(/Thanks for speaking with me/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save draft" })).not.toBeInTheDocument();
    expect(screen.queryByText("Hidden supporting quote")).not.toBeInTheDocument();
  });
});

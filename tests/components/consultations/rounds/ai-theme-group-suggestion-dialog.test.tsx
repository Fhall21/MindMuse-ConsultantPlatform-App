// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock the server action ────────────────────────────────────────────────

const mockSuggestThemeGroups = vi.hoisted(() => vi.fn());

vi.mock("@/lib/actions/consultation-workflow", () => ({
  suggestThemeGroups: mockSuggestThemeGroups,
}));

// ─── Mock sonner so toast calls don't throw ────────────────────────────────

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { AiThemeGroupSuggestionDialog } from "@/components/consultations/rounds/ai-theme-group-suggestion-dialog";
import type { SourceTheme } from "@/types/round-detail";

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeTheme(id: string, label: string, meetingId = "m-1"): SourceTheme {
  return {
    id,
    sourceMeetingId: meetingId,
    sourceMeetingTitle: "Test Meeting",
    sourceMeetingIds: [meetingId],
    sourceMeetingTitles: ["Test Meeting"],
    label,
    description: null,
    editableLabel: label,
    editableDescription: null,
    lockedFromSource: false,
    isGrouped: false,
    isUserAdded: false,
    groupId: null,
  };
}

const FIVE_THEMES: SourceTheme[] = [
  makeTheme("t1", "Burnout"),
  makeTheme("t2", "Team Support"),
  makeTheme("t3", "Management Style"),
  makeTheme("t4", "Work Hours"),
  makeTheme("t5", "Peer Relationships"),
];

const noOp = async () => {};

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("AiThemeGroupSuggestionDialog — selected-subset scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSuggestThemeGroups.mockResolvedValue([]);
  });

  it("calls suggestThemeGroups with only the selected themes, not all themes", async () => {
    const user = userEvent.setup();

    render(
      <AiThemeGroupSuggestionDialog
        open={true}
        onOpenChange={noOp}
        roundLabel="Q1 Review"
        sourceThemes={FIVE_THEMES}
        onAcceptSuggestion={noOp}
      />
    );

    // Check Burnout and Team Support only
    await user.click(screen.getByLabelText("Burnout"));
    await user.click(screen.getByLabelText("Team Support"));

    await user.click(screen.getByRole("button", { name: /generate clusters/i }));

    await waitFor(() => {
      expect(mockSuggestThemeGroups).toHaveBeenCalledTimes(1);
    });

    const [, , themeInputs] = mockSuggestThemeGroups.mock.calls[0] as [
      string | null,
      string[],
      { theme_id: string; label: string }[],
    ];

    expect(themeInputs).toHaveLength(2);
    expect(themeInputs.map((t) => t.theme_id).sort()).toEqual(["t1", "t2"]);
  });

  it("shows toast and does not call API when fewer than 2 themes are in scope", async () => {
    const user = userEvent.setup();

    render(
      <AiThemeGroupSuggestionDialog
        open={true}
        onOpenChange={noOp}
        roundLabel={null}
        sourceThemes={FIVE_THEMES}
        onAcceptSuggestion={noOp}
      />
    );

    // Select only one theme; the generate button stays disabled, no API call
    await user.click(screen.getByLabelText("Burnout"));

    // Button should be disabled with 1 selection
    const button = screen.getByRole("button", { name: /generate clusters/i });
    expect(button).toBeDisabled();
    expect(mockSuggestThemeGroups).not.toHaveBeenCalled();
  });

  it("seeds selection from initialSelectedIds when dialog opens", async () => {
    const user = userEvent.setup();

    const preSelected = new Set(["t3", "t4"]); // Management Style + Work Hours

    render(
      <AiThemeGroupSuggestionDialog
        open={true}
        onOpenChange={noOp}
        roundLabel={null}
        sourceThemes={FIVE_THEMES}
        initialSelectedIds={preSelected}
        onAcceptSuggestion={noOp}
      />
    );

    // Both pre-selected labels should already be checked
    expect(
      screen.getByRole("checkbox", { name: "Management Style" })
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Work Hours" })
    ).toBeChecked();

    // And the button should be enabled (2 in scope)
    const button = screen.getByRole("button", { name: /generate clusters/i });
    expect(button).not.toBeDisabled();

    // Clicking suggest should only send the 2 pre-selected themes
    await user.click(button);

    await waitFor(() => {
      expect(mockSuggestThemeGroups).toHaveBeenCalledTimes(1);
    });

    const [, , themeInputs] = mockSuggestThemeGroups.mock.calls[0] as [
      string | null,
      string[],
      { theme_id: string }[],
    ];

    expect(themeInputs.map((t) => t.theme_id).sort()).toEqual(["t3", "t4"]);
  });

  it("shows selected count when 2+ themes are selected", async () => {
    const user = userEvent.setup();

    render(
      <AiThemeGroupSuggestionDialog
        open={true}
        onOpenChange={noOp}
        roundLabel={null}
        sourceThemes={FIVE_THEMES}
        onAcceptSuggestion={noOp}
      />
    );

    await user.click(screen.getByLabelText("Burnout"));
    await user.click(screen.getByLabelText("Team Support"));
    await user.click(screen.getByLabelText("Management Style"));

    expect(screen.getByText("(3 selected)")).toBeInTheDocument();
  });
});

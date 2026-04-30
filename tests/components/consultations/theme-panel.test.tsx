// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemePanel } from "@/components/consultations/theme-panel";

const invalidateQueriesMock = vi.fn();

const meetingMock = {
  meeting: {
    transcript_raw: "Transcript text ready for review.",
    status: "active",
  },
  themes: [],
  people: [],
  latestEvidenceEmail: null,
};

const themeMocks = [
  {
    id: "theme-1",
    label: "Workload pressure",
    description: "The team is running hot.",
    accepted: true,
    rejected: false,
    source: "ai",
    confidence: 0.82,
  },
  {
    id: "theme-2",
    label: "Process drift",
    description: "People are improvising around the same steps.",
    accepted: false,
    rejected: false,
    source: "ai",
    confidence: 0.48,
  },
];

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
}));

vi.mock("@/hooks/use-meetings", () => ({
  useMeeting: () => ({
    data: meetingMock,
    isPending: false,
    error: null,
  }),
}));

vi.mock("@/hooks/use-themes", () => ({
  useMeetingThemes: () => ({
    data: themeMocks,
    isPending: false,
    error: null,
  }),
}));

vi.mock("@/lib/actions/themes", () => ({
  acceptTheme: vi.fn(),
  addUserTheme: vi.fn(),
  rejectTheme: vi.fn(),
  restoreTheme: vi.fn(),
  saveThemes: vi.fn(),
}));

vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
    captureException: vi.fn(),
  },
}));

vi.mock("@/components/consultations/theme-rejection-dialog", () => ({
  ThemeRejectionDialog: () => null,
}));

describe("ThemePanel", () => {
  beforeEach(() => {
    invalidateQueriesMock.mockReset();
  });

  it("does not render the clarification question field in the review flow", () => {
    render(<ThemePanel meetingId="meeting-1" />);

    expect(screen.queryByText("Need clarification?")).not.toBeInTheDocument();
    expect(screen.queryByText("Suggested clarification questions")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Accept at least one theme before requesting clarification questions.")
    ).not.toBeInTheDocument();
  });

  it("still renders the core review actions for active themes", () => {
    render(<ThemePanel meetingId="meeting-1" />);

    expect(screen.getAllByRole("button", { name: "Accept" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Reject" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Generate more insights" })).toBeInTheDocument();
  });
});

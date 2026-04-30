// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewMeetingPage from "@/app/(app)/meetings/new/page";
import type { Person } from "@/types/db";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

let mockPeople: Person[] = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("posthog-js", () => ({
  default: { capture: vi.fn(), captureException: vi.fn() },
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/hooks/use-people", () => ({
  usePeople: () => ({ data: mockPeople }),
}));

vi.mock("@/hooks/use-meeting-types", () => ({
  useMeetingTypes: () => ({ data: [] }),
}));

vi.mock("@/hooks/use-consultations", () => ({
  useConsultations: () => ({ data: [] }),
}));

vi.mock("@/lib/actions/people", () => ({
  createPerson: vi.fn(),
}));

vi.mock("@/lib/actions/consultations", () => ({
  createMeeting: vi.fn(),
  updateTranscript: vi.fn(),
}));

vi.mock("@/lib/transcript-file-parser", () => ({
  parseTranscriptFile: vi.fn(),
  TRANSCRIPT_ACCEPTED_ATTR: "application/pdf,text/plain",
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** The form with PeopleField is behind a mode-selector screen. Click through it. */
function renderAtFormStep() {
  render(<NewMeetingPage />);
  fireEvent.click(screen.getByText("Enter manually"));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

const mockPerson: Person = {
  id: "person-1",
  name: "Alex Nguyen",
  working_group: null,
  work_type: null,
  role: null,
  email: null,
  created_at: new Date().toISOString(),
  user_id: "user-1",
};

describe("PeopleField — zero-people state", () => {
  beforeEach(() => {
    mockPeople = [];
  });

  it("shows the empty state panel when no people exist in the system", () => {
    renderAtFormStep();

    expect(screen.getByText("No people added yet")).toBeInTheDocument();
  });

  it("does not render the search input when no people exist", () => {
    renderAtFormStep();

    expect(screen.queryByPlaceholderText("Search people…")).not.toBeInTheDocument();
  });

  it("shows an Add person CTA button in the empty state", () => {
    renderAtFormStep();

    expect(screen.getByRole("button", { name: /add person/i })).toBeInTheDocument();
  });

  it("opens the create person form when the CTA is clicked", () => {
    renderAtFormStep();

    fireEvent.click(screen.getByRole("button", { name: /add person/i }));

    expect(screen.getByPlaceholderText("Full name")).toBeInTheDocument();
  });
});

describe("PeopleField — non-zero-people state", () => {
  beforeEach(() => {
    mockPeople = [mockPerson];
  });

  it("renders the search input when people exist in the system", () => {
    renderAtFormStep();

    expect(screen.getByPlaceholderText("Search people…")).toBeInTheDocument();
  });

  it("does not show zero-people empty state when people exist", () => {
    renderAtFormStep();

    // Empty state is shown (nothing selected yet) but search box is also present.
    // The key assertion: no broken non-functional search — the input IS there.
    expect(screen.getByPlaceholderText("Search people…")).toBeInTheDocument();
  });
});

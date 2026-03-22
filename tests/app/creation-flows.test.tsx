// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewConsultationPage from "@/app/(app)/consultations/new/page";
import NewMeetingPage from "@/app/(app)/meetings/new/page";

const { pushMock, createRoundMock, createMeetingMock, toastErrorMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  createRoundMock: vi.fn(),
  createMeetingMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}));

vi.mock("@/lib/actions/rounds", () => ({
  createRound: createRoundMock,
}));

vi.mock("@/lib/actions/consultations", () => ({
  createMeeting: createMeetingMock,
}));

vi.mock("@/hooks/use-consultations", () => ({
  useConsultations: () => ({
    data: [
      { id: "consultation-1", label: "R2 Wellbeing Follow-up" },
      { id: "consultation-2", label: "Manager Support" },
    ],
  }),
}));

describe("creation flows", () => {
  beforeEach(() => {
    pushMock.mockReset();
    createRoundMock.mockReset();
    createMeetingMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("creates a consultation record and routes to the consultation workspace", async () => {
    createRoundMock.mockResolvedValue("consultation-123");

    render(<NewConsultationPage />);

    fireEvent.change(screen.getByLabelText("Consultation title"), {
      target: { value: "R2 Wellbeing Follow-up" },
    });
    fireEvent.change(screen.getByLabelText("Description (optional)"), {
      target: { value: "Grouped consultation evidence for depot interviews" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create consultation" }));

    await waitFor(() => {
      expect(createRoundMock).toHaveBeenCalledWith({
        label: "R2 Wellbeing Follow-up",
        description: "Grouped consultation evidence for depot interviews",
      });
      expect(pushMock).toHaveBeenCalledWith("/consultations/consultation-123");
    });
  });

  it("creates a meeting linked to the selected consultation", async () => {
    createMeetingMock.mockResolvedValue("meeting-456");

    render(<NewMeetingPage />);

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Session with Alex - March 2026" },
    });
    fireEvent.change(screen.getByLabelText("Consultation (optional)"), {
      target: { value: "consultation-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create meeting" }));

    await waitFor(() => {
      expect(createMeetingMock).toHaveBeenCalledWith({
        title: "Session with Alex - March 2026",
        consultationId: "consultation-2",
      });
      expect(pushMock).toHaveBeenCalledWith("/meetings/meeting-456");
    });
  });

  it("shows consultation labels in the meeting picker", () => {
    render(<NewMeetingPage />);

    expect(screen.getByRole("option", { name: "R2 Wellbeing Follow-up" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Manager Support" })).toBeInTheDocument();
  });
});
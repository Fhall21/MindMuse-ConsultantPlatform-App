// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DigitalInterviewsPage from "@/app/(app)/digital-interviews/page";
import type { DigitalInterviewFramework } from "@/lib/digital-interview-frameworks";

const pageState = vi.hoisted(() => ({
  isLoading: false,
  error: null as Error | null,
  data: [] as Array<{
    id: string;
    title: string;
    framework: DigitalInterviewFramework;
    status: "draft" | "active" | "closed";
    completed_count: number;
    created_at: string;
  }>,
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pageState.push,
  }),
}));

vi.mock("@/hooks/use-digital-interviews", () => ({
  useDigitalInterviews: () => ({
    data: pageState.data,
    isLoading: pageState.isLoading,
    error: pageState.error,
  }),
}));

beforeEach(() => {
  pageState.isLoading = false;
  pageState.error = null;
  pageState.data = [];
  pageState.push.mockReset();
});

describe("DigitalInterviewsPage", () => {
  it("shows loading state", () => {
    pageState.isLoading = true;

    render(<DigitalInterviewsPage />);

    expect(screen.getByText("Loading digital interviews.")).toBeInTheDocument();
  });

  it("shows empty state", () => {
    render(<DigitalInterviewsPage />);

    expect(screen.getByText("No digital interviews yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create Digital Interview" })).toHaveAttribute(
      "href",
      "/digital-interviews/new"
    );
  });

  it("shows rows and navigates on click", () => {
    pageState.data = [
      {
        id: "flow-1",
        title: "Interview A",
        framework: "appreciative_inquiry",
        status: "active",
        completed_count: 2,
        created_at: "2026-04-23T10:00:00.000Z",
      },
    ];

    render(<DigitalInterviewsPage />);

    expect(screen.getByText("Appreciative Inquiry")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("2 responses")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Interview A").closest("tr") as HTMLElement);

    expect(pageState.push).toHaveBeenCalledWith("/digital-interviews/flow-1");
  });

  it("shows error state", () => {
    pageState.error = new Error("Boom");

    render(<DigitalInterviewsPage />);

    expect(screen.getByText("Failed to load digital interviews.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create Digital Interview" })).toBeInTheDocument();
  });
});
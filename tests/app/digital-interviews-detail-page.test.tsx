// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DigitalInterviewDetailPage from "@/app/(app)/digital-interviews/[flowId]/page";

const pageState = vi.hoisted(() => ({
  flowId: "flow-1",
  isLoading: false,
  error: null as Error | null,
  data: null as null | {
    id: string;
    title: string;
    framework: "appreciative_inquiry" | "psychological_safety" | "custom";
    status: "draft" | "active" | "closed";
    completed_count: number;
    created_at: string;
    share_token: string;
  },
  invalidateQueries: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ flowId: pageState.flowId }),
  useRouter: () => ({
    refresh: pageState.refresh,
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: pageState.invalidateQueries,
  }),
}));

vi.mock("@/hooks/use-digital-interviews", () => ({
  useDigitalInterviewDetail: () => ({
    data: pageState.data,
    isLoading: pageState.isLoading,
    error: pageState.error,
  }),
}));

beforeEach(() => {
  pageState.flowId = "flow-1";
  pageState.isLoading = false;
  pageState.error = null;
  pageState.data = {
    id: "flow-1",
    title: "Interview A",
    framework: "appreciative_inquiry",
    status: "draft",
    completed_count: 2,
    created_at: "2026-04-23T10:00:00.000Z",
    share_token: "share-1",
  };
  pageState.invalidateQueries.mockReset();
  pageState.refresh.mockReset();
});

describe("DigitalInterviewDetailPage", () => {
  it("shows the interview metadata and admin actions", () => {
    render(<DigitalInterviewDetailPage />);

    expect(screen.getByRole("heading", { name: "Interview A" })).toBeInTheDocument();
    expect(screen.getByText(/Appreciative Inquiry/)).toBeInTheDocument();
    expect(screen.getByText(/2 responses received/)).toBeInTheDocument();
    expect(screen.getByText("/interview/share-1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy share link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activate Interview" })).toBeInTheDocument();
  });
});

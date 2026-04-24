// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DigitalInterviewDetailPage from "@/app/(app)/digital-interviews/[flowId]/page";
import type { DigitalInterviewFramework } from "@/lib/digital-interview-frameworks";

type FlowDetail = {
  id: string;
  title: string;
  framework: DigitalInterviewFramework;
  status: "draft" | "active" | "closed";
  completed_count: number;
  consultation_id: string | null;
  share_token: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  custom_framework_prompt: string | null;
  topics: string[];
  guardrails_config: {
    acceptedRecommendedIds: string[];
    dismissedRecommendedIds: string[];
    customGuardrails: string[];
  };
  depth_level: "surface" | "moderate" | "deep";
  responses: Array<{
    id: string;
    flow_id: string;
    interviewee_name: string | null;
    interviewee_role: string | null;
    interviewee_organisation: string | null;
    person_id: string | null;
    status: "in_progress" | "completed" | "abandoned";
    completed_at: string | null;
    created_at: string;
    boundary_moments: Array<{
      source: "universal" | "recommended" | "custom";
      label: string;
      reason: string | null;
      turn_index: number;
      timestamp: string | null;
    }>;
  }>;
};

let mockFlow: FlowDetail | null = null;
let mockIsPending = false;
let mockError: Error | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  useParams: () => ({ flowId: "flow-1" }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/hooks/use-digital-interviews", () => ({
  useDigitalInterviewDetail: () => ({
    data: mockFlow,
    isPending: mockIsPending,
    isLoading: false,
    error: mockError,
  }),
}));

vi.mock("@/components/digital-interviews/response-card", () => ({
  ResponseCard: ({ response }: { response: { id: string } }) => (
    <div data-testid={`response-card-${response.id}`} />
  ),
}));

vi.mock("@/components/digital-interviews/digital-interview-theme-panel", () => ({
  DigitalInterviewThemePanel: () => <div data-testid="theme-panel" />,
}));

beforeEach(() => {
  mockIsPending = false;
  mockError = null;
  mockFlow = {
    id: "flow-1",
    title: "Interview A",
    framework: "appreciative_inquiry",
    status: "draft",
    completed_count: 1,
    consultation_id: null,
    share_token: "share-1",
    created_at: "2026-04-23T10:00:00.000Z",
    updated_at: "2026-04-23T10:00:00.000Z",
    user_id: "user-1",
    custom_framework_prompt: null,
    topics: [],
    guardrails_config: {
      acceptedRecommendedIds: [],
      dismissedRecommendedIds: [],
      customGuardrails: [],
    },
    depth_level: "moderate",
    responses: [
      {
        id: "resp-1",
        flow_id: "flow-1",
        interviewee_name: "Jane Doe",
        interviewee_role: "Manager",
        interviewee_organisation: "ACME",
        person_id: null,
        status: "completed",
        completed_at: "2026-04-23T11:00:00.000Z",
        created_at: "2026-04-23T10:30:00.000Z",
        boundary_moments: [],
      },
    ],
  };
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ data: [] }), { status: 200 })
  ) as never;
});

describe("DigitalInterviewDetailPage", () => {
  it("shows the interview title", async () => {
    render(<DigitalInterviewDetailPage />);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Interview A");
  });

  it("shows response count", async () => {
    render(<DigitalInterviewDetailPage />);
    expect(await screen.findByText(/1 response received/)).toBeInTheDocument();
  });

  it("renders theme panel", async () => {
    render(<DigitalInterviewDetailPage />);
    expect(await screen.findByTestId("theme-panel")).toBeInTheDocument();
  });

  it("shows active boundaries", async () => {
    mockFlow!.guardrails_config = {
      acceptedRecommendedIds: ["recommended-avoid-medical-detail"],
      dismissedRecommendedIds: [],
      customGuardrails: ["Do not ask for manager names."],
    };
    mockFlow!.topics = ["Burnout"];
    render(<DigitalInterviewDetailPage />);
    expect(await screen.findByText("Active boundaries")).toBeInTheDocument();
    expect(await screen.findByText("Avoid private health detail")).toBeInTheDocument();
    expect(await screen.findAllByText("Do not ask for manager names.")).toHaveLength(2);
  });

  it("renders feature placeholder cards", async () => {
    render(<DigitalInterviewDetailPage />);
    expect(await screen.findByText("Statement voting")).toBeInTheDocument();
    expect(await screen.findByText("In-interview surveys")).toBeInTheDocument();
  });

  it("shows empty state when no responses", async () => {
    mockFlow!.responses = [];
    render(<DigitalInterviewDetailPage />);
    expect(await screen.findByText(/Share the interview link to start collecting data/)).toBeInTheDocument();
  });

  it("shows error state", async () => {
    mockFlow = null;
    mockError = new Error("Network error");
    render(<DigitalInterviewDetailPage />);
    expect(await screen.findByText(/Failed to load interview data/)).toBeInTheDocument();
  });
});

// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasShell } from "@/components/canvas/canvas-shell";
import type { CanvasData } from "@/hooks/use-canvas";

const createEdgeMock = vi.fn();
const updateEdgeMock = vi.fn();
const { createThemeMock, moveThemeToGroupMock } = vi.hoisted(() => ({
  createThemeMock: vi.fn(),
  moveThemeToGroupMock: vi.fn(),
}));

const canvasData: CanvasData = {
  consultation_id: "consultation-1",
  round_id: "round-1",
  viewport: { x: 0, y: 0, zoom: 1 },
  nodes: [
    {
      id: "insight-1",
      type: "insight",
      label: "Fatigue complaints",
      description: null,
      accepted: true,
      subgroup: null,
      sourceConsultationId: "consultation-1",
      sourceConsultationTitle: "North depot interview",
      groupId: "theme-1",
      memberIds: [],
      isUserAdded: false,
      lockedFromSource: false,
      position: { x: 0, y: 0 },
    },
    {
      id: "insight-2",
      type: "insight",
      label: "Supervision gaps",
      description: null,
      accepted: true,
      subgroup: null,
      sourceConsultationId: "consultation-2",
      sourceConsultationTitle: "Yard follow-up",
      groupId: null,
      memberIds: [],
      isUserAdded: false,
      lockedFromSource: false,
      position: { x: 80, y: 80 },
    },
  ],
  edges: [
    {
      id: "edge-1",
      source_node_id: "insight-1",
      target_node_id: "insight-2",
      connection_type: "related_to",
      note: null,
      created_by: "user-1",
      created_at: "2026-03-21T00:00:00.000Z",
      updated_at: "2026-03-21T00:00:00.000Z",
    },
  ],
};

vi.mock("@/components/canvas/canvas-graph", () => ({
  CanvasGraph: ({
    onCreateEdge,
    onGroupDrop,
  }: {
    onCreateEdge: (payload: Record<string, unknown>) => Promise<unknown>;
    onGroupDrop: (payload: { activeNodeId: string; targetNodeId: string | null }) => Promise<void>;
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          void onCreateEdge({
            source_node_type: "insight",
            source_node_id: "insight-1",
            target_node_type: "insight",
            target_node_id: "insight-2",
            connection_type: "related_to",
          })
        }
      >
        Create connection
      </button>
      <button
        type="button"
        onClick={() => void onGroupDrop({ activeNodeId: "insight-1", targetNodeId: null })}
      >
        Ungroup insight
      </button>
    </div>
  ),
}));

vi.mock("@/components/canvas/node-detail-panel", () => ({
  NodeDetailPanel: () => <div>Node detail panel</div>,
}));

vi.mock("@/components/canvas/ai-suggestions-panel", () => ({
  AiSuggestionsPanel: () => <div>AI suggestions</div>,
}));

vi.mock("@/hooks/use-canvas", () => ({
  useCanvas: () => ({ data: canvasData }),
  useCreateEdge: () => ({
    mutateAsync: createEdgeMock,
  }),
  useUpdateEdge: () => ({
    mutateAsync: updateEdgeMock,
  }),
}));

vi.mock("@/lib/actions/consultation-workflow", () => ({
  createTheme: createThemeMock,
  moveThemeToGroup: moveThemeToGroupMock,
}));

afterEach(() => {
  createEdgeMock.mockReset();
  updateEdgeMock.mockReset();
  createThemeMock.mockReset();
  moveThemeToGroupMock.mockReset();
});

function renderShell() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <CanvasShell
        roundId="round-1"
        roundLabel="North depot interview"
      />
    </QueryClientProvider>
  );
}

describe("CanvasShell", () => {
  it("opens the quick connection prompt after creating a connection and saves the selected type", async () => {
    createEdgeMock.mockResolvedValue({
      ...canvasData.edges[0],
      id: "edge-created",
    });
    updateEdgeMock.mockResolvedValue({
      ...canvasData.edges[0],
      id: "edge-created",
      connection_type: "causes",
      note: "This escalates the outcome.",
    });

    renderShell();

    await act(async () => {
      fireEvent.click(screen.getByText("Create connection"));
    });

    expect(await screen.findByText("Set connection type")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Causes" }));
    });
    fireEvent.change(screen.getByPlaceholderText("Why does this relationship matter?"), {
      target: { value: "This escalates the outcome." },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(updateEdgeMock).toHaveBeenCalledWith({
      id: "edge-created",
      connection_type: "causes",
      note: "This escalates the outcome.",
    });
  });

  it("ungroups a grouped insight when dropped on empty canvas", async () => {
    renderShell();

    await act(async () => {
      fireEvent.click(screen.getByText("Ungroup insight"));
    });

    expect(moveThemeToGroupMock).toHaveBeenCalledWith("insight-1", null);
  });
});

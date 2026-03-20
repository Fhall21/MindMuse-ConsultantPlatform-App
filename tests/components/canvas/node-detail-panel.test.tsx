// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NodeDetailPanel } from "@/components/canvas/node-detail-panel";

const updateEdgeMock = vi.fn();
const deleteEdgeMutateMock = vi.fn();

vi.mock("@/hooks/use-canvas", () => ({
  useUpdateEdge: () => ({
    mutateAsync: updateEdgeMock,
    isPending: false,
  }),
  useDeleteEdge: () => ({
    mutate: deleteEdgeMutateMock,
    isPending: false,
  }),
}));

afterEach(() => {
  updateEdgeMock.mockReset();
  deleteEdgeMutateMock.mockReset();
});

describe("NodeDetailPanel", () => {
  it("supports quick type editing, note save, and delete confirmation for an edge", async () => {
    const quickTypeSelect = vi.fn();

    render(
      <NodeDetailPanel
        selectedNodeId={null}
        selectedEdgeId="edge-1"
        nodes={[
          {
            id: "insight-1",
            type: "insight",
            label: "Fatigue complaints",
            description: null,
            accepted: true,
            subgroup: null,
            sourceConsultationId: "consultation-1",
            sourceConsultationTitle: "North depot interview",
            groupId: null,
            memberIds: [],
            isUserAdded: false,
            lockedFromSource: false,
            position: { x: 0, y: 0 },
          },
          {
            id: "theme-1",
            type: "theme",
            label: "Operational stressors",
            description: null,
            accepted: true,
            subgroup: null,
            sourceConsultationId: null,
            sourceConsultationTitle: null,
            groupId: null,
            memberIds: ["insight-1"],
            isUserAdded: false,
            lockedFromSource: false,
            position: { x: 200, y: 80 },
          },
        ]}
        edges={[
          {
            id: "edge-1",
            source_node_id: "insight-1",
            target_node_id: "theme-1",
            connection_type: "related_to",
            note: null,
            created_by: "user-1",
            created_at: "2026-03-21T00:00:00.000Z",
            updated_at: "2026-03-21T00:00:00.000Z",
          },
        ]}
        consultationId="consultation-1"
        onQuickTypeSelect={quickTypeSelect}
        onUngroupInsight={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Change type" }));
    expect(quickTypeSelect).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByPlaceholderText("Add a note about this connection…"), {
      target: { value: "This pattern reinforces the group." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    expect(updateEdgeMock).toHaveBeenCalledWith({
      id: "edge-1",
      note: "This pattern reinforces the group.",
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete connection" }));
    fireEvent.click(screen.getByRole("button", { name: "Click again to confirm" }));

    expect(deleteEdgeMutateMock).toHaveBeenCalledWith(
      "edge-1",
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });
});

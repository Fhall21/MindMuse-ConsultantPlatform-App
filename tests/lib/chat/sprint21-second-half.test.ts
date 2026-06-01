import { describe, expect, it } from "vitest";
import {
  buildGroupingReviewOutput,
  readGroupingReviewOutput,
} from "@/lib/chat/tools/grouping";
import { readCanvasLayoutPreview } from "@/lib/chat/tools/canvas";
import { readResearchQuestionReviewOutput } from "@/lib/chat/tools/async-actions";
import { isChatCardToolName } from "@/lib/chat/card-tools";

describe("grouping tools", () => {
  it("round-trips propose grouping review output", () => {
    const output = buildGroupingReviewOutput({
      consultationId: "11111111-1111-4111-8111-111111111111",
      mode: "propose",
      groupName: "Leadership",
      groupDescription: "Themes about leadership pressure.",
      themeIds: ["22222222-2222-4222-8222-222222222222"],
      rationale: "Clustered by semantic overlap.",
      availableThemes: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          label: "Leadership load",
          description: "Pressure from senior stakeholders.",
          source_meeting_id: "33333333-3333-4333-8333-333333333333",
          source_meeting_title: "Exec interview",
        },
      ],
    });

    const parsed = readGroupingReviewOutput(output);
    expect(parsed?.group_name).toBe("Leadership");
    expect(parsed?.mode).toBe("propose");
    expect(parsed?.available_themes[0]?.source_meeting_title).toBe("Exec interview");
  });

  it("round-trips link grouping review output", () => {
    const output = buildGroupingReviewOutput({
      consultationId: "11111111-1111-4111-8111-111111111111",
      mode: "link",
      groupName: "Leadership",
      groupDescription: "Existing leadership cluster.",
      themeIds: ["22222222-2222-4222-8222-222222222222"],
      rationale: "Link matching insights.",
      availableThemes: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          label: "Stakeholder pressure",
          description: "Board expectations.",
        },
      ],
      targetGroupId: "44444444-4444-4444-8444-444444444444",
    });

    const parsed = readGroupingReviewOutput(output);
    expect(parsed?.mode).toBe("link");
    expect(parsed?.target_group_id).toBe("44444444-4444-4444-8444-444444444444");
  });

  it("reads existing_groups on review output", () => {
    const output = buildGroupingReviewOutput({
      consultationId: "11111111-1111-4111-8111-111111111111",
      groupName: "Leadership",
      groupDescription: "",
      themeIds: [],
      rationale: "Review clusters.",
      availableThemes: [],
      existingGroups: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          label: "Leadership",
          description: "Existing",
          status: "accepted",
          origin: "manual",
          member_insight_ids: ["22222222-2222-4222-8222-222222222222"],
          members: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              label: "Load",
              description: "",
            },
          ],
        },
      ],
    });

    expect(readGroupingReviewOutput(output)?.existing_groups).toHaveLength(1);
  });

  it("defaults legacy output without mode to propose", () => {
    const parsed = readGroupingReviewOutput({
      consultation_id: "11111111-1111-4111-8111-111111111111",
      group_name: "Legacy",
      group_description: "",
      theme_ids: [],
      rationale: "Old row",
      available_themes: [],
    });

    expect(parsed?.mode).toBe("propose");
  });
});

describe("canvas preview helpers", () => {
  it("reads full canvas layout preview output", () => {
    const preview = readCanvasLayoutPreview({
      consultation_id: "11111111-1111-4111-8111-111111111111",
      canvas_nodes: [
        {
          id: "a",
          type: "theme",
          label: "Group A",
          description: null,
          accepted: true,
          subgroup: null,
          sourceConsultationId: null,
          sourceConsultationTitle: null,
          groupId: null,
          memberIds: ["b"],
          isUserAdded: false,
          lockedFromSource: false,
          position: { x: 10, y: 20 },
        },
        {
          id: "b",
          type: "insight",
          label: "Insight B",
          description: null,
          accepted: true,
          subgroup: null,
          sourceConsultationId: null,
          sourceConsultationTitle: null,
          groupId: "a",
          memberIds: [],
          isUserAdded: false,
          lockedFromSource: false,
          position: { x: 40, y: 160 },
        },
      ],
      canvas_edges: [
        {
          id: "edge-1",
          source_node_id: "a",
          target_node_id: "c",
          connection_type: "supports",
          note: null,
          created_by: "test",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      node_count: 2,
      group_count: 1,
    });

    expect(preview?.group_count).toBe(1);
    expect(preview?.canvas_nodes).toHaveLength(2);
    expect(preview?.canvas_edges[0]?.connection_type).toBe("supports");
  });

  it("reads legacy simplified canvas preview nodes", () => {
    const preview = readCanvasLayoutPreview({
      consultation_id: "11111111-1111-4111-8111-111111111111",
      nodes: [{ id: "a", label: "Group A", x: 10, y: 20, type: "theme" }],
      edges: [{ from: "a", to: "b" }],
      node_count: 1,
      group_count: 1,
    });

    expect(preview?.canvas_nodes[0]?.position).toEqual({ x: 10, y: 20 });
    expect(preview?.canvas_edges[0]?.target_node_id).toBe("b");
  });
});

describe("async card registry", () => {
  it("registers sprint 21 second-half card tools", () => {
    expect(isChatCardToolName("group_themes")).toBe(true);
    expect(isChatCardToolName("link_insights_to_group")).toBe(true);
    expect(isChatCardToolName("preview_canvas")).toBe(true);
    expect(isChatCardToolName("draft_evidence_email")).toBe(true);
    expect(isChatCardToolName("generate_report")).toBe(true);
    expect(isChatCardToolName("generate_research_questions")).toBe(true);
  });

  it("reads research question review output", () => {
    const review = readResearchQuestionReviewOutput({
      consultation_id: "11111111-1111-4111-8111-111111111111",
      questions: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          question: "What evidence supports this theme elsewhere?",
          rationale: "Cross-consultation validation.",
        },
      ],
      dismissed_question_ids: [],
    });

    expect(review?.questions).toHaveLength(1);
  });
});

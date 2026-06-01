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
  it("reads canvas layout preview output", () => {
    const preview = readCanvasLayoutPreview({
      consultation_id: "11111111-1111-4111-8111-111111111111",
      nodes: [{ id: "a", label: "Group A", x: 10, y: 20, type: "theme" }],
      edges: [{ from: "a", to: "b" }],
      node_count: 1,
      group_count: 1,
    });

    expect(preview?.group_count).toBe(1);
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

import { describe, expect, it } from "vitest";
import {
  buildGroupingReviewOutput,
  readGroupingReviewOutput,
} from "@/lib/chat/tools/grouping";
import { readCanvasLayoutPreview } from "@/lib/chat/tools/canvas";
import { readResearchQuestionReviewOutput } from "@/lib/chat/tools/async-actions";
import { isChatCardToolName } from "@/lib/chat/card-tools";

describe("grouping tools", () => {
  it("round-trips grouping review output", () => {
    const output = buildGroupingReviewOutput({
      consultationId: "11111111-1111-4111-8111-111111111111",
      groupName: "Leadership",
      groupDescription: "Themes about leadership pressure.",
      themeIds: ["22222222-2222-4222-8222-222222222222"],
      rationale: "Clustered by semantic overlap.",
      availableThemes: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          label: "Leadership load",
          description: "Pressure from senior stakeholders.",
        },
      ],
    });

    expect(readGroupingReviewOutput(output)?.group_name).toBe("Leadership");
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

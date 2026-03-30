import { describe, expect, it } from "vitest";

import { renderStructuredReportDocumentMarkdown } from "@/lib/report-document";

describe("lib/report-document - renderStructuredReportDocumentMarkdown", () => {
  it("renders sections and subsections into stable markdown headings", () => {
    const markdown = renderStructuredReportDocumentMarkdown({
      sections: [
        {
          heading: "Executive Summary",
          paragraphs: ["A concise overview of the round."],
        },
        {
          heading: "Accepted Round Themes",
          subsections: [
            {
              heading: "Workload Pressure",
              paragraphs: ["This theme was raised across multiple meetings."],
              bullet_points: ["High workload during peak periods", "Limited recovery time"],
            },
          ],
        },
      ],
    });

    expect(markdown).toBe([
      "## Executive Summary",
      "",
      "A concise overview of the round.",
      "",
      "## Accepted Round Themes",
      "",
      "### Workload Pressure",
      "",
      "This theme was raised across multiple meetings.",
      "",
      "- High workload during peak periods",
      "- Limited recovery time",
    ].join("\n"));
  });

  it("omits empty headings and strips extra whitespace from content", () => {
    const markdown = renderStructuredReportDocumentMarkdown({
      sections: [
        {
          heading: "  Supporting Consultation-Level Evidence Themes  ",
          bullet_points: ["  Evidence item one  ", "Evidence     item two"],
          subsections: [{ heading: "   ", paragraphs: ["Ignored subsection"] }],
        },
      ],
    });

    expect(markdown).toBe([
      "## Supporting Consultation-Level Evidence Themes",
      "",
      "- Evidence item one",
      "- Evidence item two",
    ].join("\n"));
  });
});

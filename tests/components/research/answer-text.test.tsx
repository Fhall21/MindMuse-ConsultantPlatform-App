// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnswerText } from "@/components/research/answer-text";

const references = [
  {
    number: 1,
    citation_key: "source-1",
    title: "Beauty and usability",
    authors: "Hassenzahl",
    year: "2004",
    journal: "HCI",
    url: "https://example.com/1",
  },
];

const evidence = [
  {
    id: "pqac-00000019",
    question: "What changed in visual style cues?",
    excerpt: "Flat and almost-flat design changed how signifiers are interpreted.",
    score: 9,
  },
];

describe("AnswerText", () => {
  it("renders Edison markdown tables inline with citation and evidence chips", () => {
    render(
      <AnswerText
        text={[
          "Intro paragraph [1].",
          "",
          "## Summary framework",
          "| Dimension | Evidence summary | Representative citations |",
          "|---|---|---|",
          "| Visual style cues | Evidence cites pqac-00000019 and [1.1]. | (pqac-00000019) |",
          "",
          "Closing paragraph.",
        ].join("\n")}
        references={references}
        evidence={evidence}
      />
    );

    expect(screen.getByText("Summary framework")).toBeInTheDocument();

    const table = screen.getByRole("table");
    expect(within(table).getByText("Dimension")).toBeInTheDocument();
    expect(within(table).getByText("Visual style cues")).toBeInTheDocument();
    expect(within(table).getAllByLabelText("Evidence pqac-00000019")).toHaveLength(2);
    expect(within(table).getByRole("button", { name: /Citation 1.1/ })).toBeInTheDocument();
  });

  it("keeps body paragraphs that immediately follow markdown headings", () => {
    render(
      <AnswerText
        text={[
          "## 1) What makes an interactive product attractive",
          "HCI research distinguishes beauty from usability, even though they can correlate. [1]",
          "Empirically, beauty tends to relate more strongly to hedonic qualities.",
          "",
          "### 1.1 Core construct",
          "This paragraph should remain visible too.",
        ].join("\n")}
        references={references}
      />
    );

    expect(
      screen.getByText("1) What makes an interactive product attractive")
    ).toBeInTheDocument();
    expect(screen.getByText(/HCI research distinguishes beauty/)).toBeInTheDocument();
    expect(screen.getByText(/Empirically, beauty tends/)).toBeInTheDocument();
    expect(screen.getByText("1.1 Core construct")).toBeInTheDocument();
    expect(screen.getByText("This paragraph should remain visible too.")).toBeInTheDocument();
  });
});

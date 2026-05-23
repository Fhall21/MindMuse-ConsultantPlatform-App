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

  it("renders tables when body rows omit the trailing pipe", () => {
    render(
      <AnswerText
        text={[
          "| Dimension | Evidence |",
          "|---|---|",
          "| Visual style | Flat design cues",
        ].join("\n")}
      />
    );

    const table = screen.getByRole("table");
    expect(within(table).getByText("Dimension")).toBeInTheDocument();
    expect(within(table).getByText("Visual style")).toBeInTheDocument();
    expect(within(table).getByText("Flat design cues")).toBeInTheDocument();
  });

  it("keeps table blocks together when blank lines appear inside the table", () => {
    render(
      <AnswerText
        text={[
          "| Dimension | Evidence |",
          "",
          "|---|---|",
          "",
          "| Visual style | Flat design cues |",
        ].join("\n")}
      />
    );

    const table = screen.getByRole("table");
    expect(within(table).getByText("Dimension")).toBeInTheDocument();
    expect(within(table).getByText("Visual style")).toBeInTheDocument();
    expect(within(table).getByText("Flat design cues")).toBeInTheDocument();
  });

  it("falls back to preformatted text for header-only table blocks", () => {
    const text = ["| Dimension | Evidence |", "|---|---|"].join("\n");
    const { container } = render(<AnswerText text={text} />);

    expect(container.querySelector("table")).toBeNull();
    const pre = container.querySelector("pre");
    expect(pre).toBeTruthy();
    expect(pre?.textContent).toContain("| Dimension | Evidence |");
    expect(pre?.textContent).toContain("|---|---|");
  });
});

describe("AnswerText list rendering", () => {
  it("renders unordered bullet lists", () => {
    const { container } = render(
      <AnswerText text={"- First item\n- Second item\n- Third item"} />
    );

    const list = container.querySelector("ul");
    expect(list).toBeTruthy();
    expect(list?.className).toContain("list-disc");

    const items = list?.querySelectorAll("li");
    expect(items).toHaveLength(3);
    expect(items?.[0]).toHaveTextContent("First item");
    expect(items?.[1]).toHaveTextContent("Second item");
    expect(items?.[2]).toHaveTextContent("Third item");
  });

  it("renders asterisk and plus unordered markers", () => {
    const { container } = render(
      <AnswerText text={"* Alpha\n+ Beta"} />
    );

    const items = container.querySelectorAll("ul li");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Alpha");
    expect(items[1]).toHaveTextContent("Beta");
  });

  it("renders ordered numbered lists", () => {
    const { container } = render(
      <AnswerText text={"1. Step one\n2. Step two\n3. Step three"} />
    );

    const list = container.querySelector("ol");
    expect(list).toBeTruthy();
    expect(list?.className).toContain("list-decimal");

    const items = list?.querySelectorAll("li");
    expect(items).toHaveLength(3);
    expect(items?.[0]).toHaveTextContent("Step one");
    expect(items?.[2]).toHaveTextContent("Step three");
  });

  it("renders paragraphs and lists in the same block", () => {
    const { container } = render(
      <AnswerText
        text={
          "Summary intro.\n\n- Finding one\n- Finding two\n\nClosing note."
        }
      />
    );

    expect(screen.getByText("Summary intro.")).toBeTruthy();
    expect(screen.getByText("Closing note.")).toBeTruthy();

    const items = container.querySelectorAll("ul li");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Finding one");
  });

  it("preserves inline bold formatting in list items", () => {
    render(<AnswerText text={"- **Key risk**: burnout\n- **Action**: review"} />);

    expect(screen.getByText("Key risk")).toBeTruthy();
    expect(screen.getByText("Action")).toBeTruthy();
    expect(screen.getByText("Key risk").tagName).toBe("STRONG");
  });

  it("splits consecutive unordered and ordered lists", () => {
    const { container } = render(
      <AnswerText text={"- Bullet A\n- Bullet B\n1. Number one\n2. Number two"} />
    );

    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
  });

  it("renders dash-space bullet lines as unordered lists", () => {
    const { container } = render(<AnswerText text={"- item one\n- item two"} />);

    expect(container.querySelector("ul")).toBeTruthy();
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(container.querySelector("ul li")).toHaveTextContent("item one");
  });

  it("does not treat mid-sentence dashes as bullet lists", () => {
    const { container } = render(
      <AnswerText text={"This is a sentence - with a dash\nAnother line - also fine"} />
    );

    expect(container.querySelector("ul")).toBeNull();
    expect(container.querySelector("ol")).toBeNull();
    expect(container.textContent).toContain("This is a sentence - with a dash");
    expect(container.textContent).toContain("Another line - also fine");
  });

  it("does not treat dash-without-space as a bullet list", () => {
    const { container } = render(<AnswerText text={"-no space\n-more dashes"} />);

    expect(container.querySelector("ul")).toBeNull();
    expect(container.querySelector("ol")).toBeNull();
    expect(container.textContent).toContain("-no space");
    expect(container.textContent).toContain("-more dashes");
  });

  it("renders asterisk and ordered markers", () => {
    const { container } = render(<AnswerText text={"* item\n1. item"} />);

    expect(container.querySelector("ul li")).toHaveTextContent("item");
    expect(container.querySelector("ol li")).toHaveTextContent("item");
  });

  it("allows up to four spaces of indent for nested bullets", () => {
    const { container } = render(
      <AnswerText text={"- top level\n  - nested\n    - deeper"} />
    );

    expect(container.querySelectorAll("ul li")).toHaveLength(3);
  });
});

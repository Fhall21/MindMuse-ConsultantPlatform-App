// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ResearchPage from "@/app/(app)/research/page";

describe("ResearchPage", () => {
  it("renders Literature and Data Analysis tabs", () => {
    render(<ResearchPage />);

    expect(screen.getByRole("heading", { name: "Research" })).toBeInTheDocument();
    expect(screen.getByText("Edison-backed literature search will appear here.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Data Analysis" }));

    expect(screen.getByText("Edison-backed data analysis will appear here.")).toBeInTheDocument();
    expect(screen.queryByText("Edison-backed literature search will appear here.")).not.toBeInTheDocument();
  });
});

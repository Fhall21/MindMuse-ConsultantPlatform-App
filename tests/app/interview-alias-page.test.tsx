// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import InterviewAliasPage from "@/app/interview/[shareToken]/page";

vi.mock("@/components/interview/interview-session-page", () => ({
  InterviewSessionPage: ({ shareToken }: { shareToken: string }) => (
    <div data-testid="interview-session">{shareToken}</div>
  ),
}));

describe("InterviewAliasPage", () => {
  it("serves previously copied /interview share links", async () => {
    render(
      await InterviewAliasPage({
        params: Promise.resolve({ shareToken: "share-1" }),
      })
    );

    expect(screen.getByTestId("interview-session")).toHaveTextContent("share-1");
  });
});

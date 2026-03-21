// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourceThemeCard } from "@/components/consultations/rounds/source-theme-card";

describe("SourceThemeCard", () => {
  it("shows the source meeting pill on the card", () => {
    render(
      <SourceThemeCard
        theme={{
          id: "theme-1",
          sourceMeetingId: "consultation-1",
          sourceMeetingTitle: "North depot interview",
          label: "Staff fatigue",
          description: "Repeated fatigue concerns across the shift.",
          editableLabel: "Staff fatigue",
          editableDescription: "Repeated fatigue concerns across the shift.",
          lockedFromSource: false,
          isGrouped: false,
          isUserAdded: false,
          groupId: null,
        }}
      />
    );

    expect(screen.getByText("North depot interview")).toBeInTheDocument();
    expect(screen.getByText("Staff fatigue")).toBeInTheDocument();
  });
});

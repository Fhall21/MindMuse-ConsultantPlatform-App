// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourceThemeCard } from "@/components/consultations/rounds/source-theme-card";

describe("SourceThemeCard", () => {
  it("shows the source consultation pill on the card", () => {
    render(
      <SourceThemeCard
        theme={{
          id: "theme-1",
          sourceConsultationId: "consultation-1",
          sourceConsultationTitle: "North depot interview",
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

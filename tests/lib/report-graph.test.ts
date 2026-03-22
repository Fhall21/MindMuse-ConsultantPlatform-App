import { describe, expect, it } from "vitest";

import {
  getAcceptedConsultationThemes,
  getMeetingTitles,
  getSupportingMeetingThemes,
  toReportInputSnapshot,
} from "@/lib/report-graph";

describe("lib/report-graph", () => {
  it("normalizes legacy report snapshot keys into the stage-8 names", () => {
    const acceptedThemes = [{ label: "Workload" }];
    const supportingThemes = [{ label: "Burnout risk" }];

    expect(
      toReportInputSnapshot({
        round_id: "consultation-1",
        consultations: ["Meeting A"],
        accepted_round_themes: acceptedThemes,
        supporting_consultation_themes: supportingThemes,
      })
    ).toMatchObject({
      consultationId: "consultation-1",
      roundId: "consultation-1",
      meetingTitles: ["Meeting A"],
      consultations: ["Meeting A"],
      accepted_consultation_themes: acceptedThemes,
      accepted_round_themes: acceptedThemes,
      supporting_meeting_themes: supportingThemes,
      supporting_consultation_themes: supportingThemes,
    });
  });

  it("reads stage-8 snapshot keys directly through the compatibility helpers", () => {
    const snapshot = {
      consultationId: "consultation-2",
      meetingTitles: ["Meeting B"],
      accepted_consultation_themes: [{ label: "Communication" }],
      supporting_meeting_themes: [{ label: "Coverage gap" }],
    };

    expect(getMeetingTitles(snapshot)).toEqual(["Meeting B"]);
    expect(getAcceptedConsultationThemes(snapshot)).toEqual([
      { label: "Communication" },
    ]);
    expect(getSupportingMeetingThemes(snapshot)).toEqual([
      { label: "Coverage gap" },
    ]);
  });
});
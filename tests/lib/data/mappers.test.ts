import { describe, expect, it } from "vitest";
import {
  mapConsultationRecord,
  mapRoundOutputArtifactRecord,
  mapInsightRecord,
} from "@/lib/data/mappers";

describe("lib/data/mappers", () => {
  it("maps consultation rows into the API-safe shape", () => {
    const createdAt = new Date("2026-03-19T01:02:03.000Z");
    const updatedAt = new Date("2026-03-19T04:05:06.000Z");

    expect(
      mapConsultationRecord({
        id: "consultation-1",
        title: "Consultation",
        transcriptRaw: "Transcript",
        userId: "user-1",
        status: "draft",
        roundId: "round-1",
        createdAt,
        updatedAt,
      } as never)
    ).toEqual({
      id: "consultation-1",
      title: "Consultation",
      transcript_raw: "Transcript",
      notes: null,
      created_at: createdAt.toISOString(),
      updated_at: updatedAt.toISOString(),
      user_id: "user-1",
      status: "draft",
      round_id: "round-1",
    });
  });

  it("normalizes numeric theme weights from Drizzle rows", () => {
    const createdAt = new Date("2026-03-19T01:02:03.000Z");

    expect(
      mapInsightRecord({
        id: "theme-1",
        consultationId: "consultation-1",
        label: "Workload",
        description: null,
        accepted: true,
        isUserAdded: false,
        weight: "0.75",
        createdAt,
      } as never).weight
    ).toBe(0.75);
  });

  it("maps round output artifacts with serialized timestamps", () => {
    const generatedAt = new Date("2026-03-19T01:02:03.000Z");
    const createdAt = new Date("2026-03-19T01:05:03.000Z");
    const updatedAt = new Date("2026-03-19T01:06:03.000Z");

    expect(
      mapRoundOutputArtifactRecord({
        id: "artifact-1",
        roundId: "round-1",
        userId: "user-1",
        artifactType: "report",
        status: "generated",
        title: "Draft report",
        content: "Body",
        inputSnapshot: { themes: 2 },
        generatedAt,
        createdAt,
        updatedAt,
        createdBy: "user-1",
      } as never)
    ).toEqual({
      id: "artifact-1",
      round_id: "round-1",
      user_id: "user-1",
      artifact_type: "report",
      status: "generated",
      title: "Draft report",
      content: "Body",
      input_snapshot: { themes: 2 },
      generated_at: generatedAt.toISOString(),
      created_at: createdAt.toISOString(),
      updated_at: updatedAt.toISOString(),
      created_by: "user-1",
    });
  });
});

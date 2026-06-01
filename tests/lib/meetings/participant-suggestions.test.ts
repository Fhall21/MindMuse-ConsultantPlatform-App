import { describe, expect, it } from "vitest";
import { splitParticipantSuggestions } from "@/lib/meetings/participant-suggestions";
import type { Person } from "@/types/db";

const people: Person[] = [
  {
    id: "person-1",
    name: "Alex Chen",
    working_group: null,
    work_type: null,
    role: null,
    email: null,
    created_at: "2026-01-01T00:00:00.000Z",
    user_id: "user-1",
  },
];

describe("splitParticipantSuggestions", () => {
  it("matches existing contacts case-insensitively", () => {
    const result = splitParticipantSuggestions(["alex chen", "Jordan Lee"], people);

    expect(result.suggestedExisting).toHaveLength(1);
    expect(result.suggestedExisting[0]?.id).toBe("person-1");
    expect(result.suggestedNewNames).toEqual(["Jordan Lee"]);
  });

  it("deduplicates repeated names", () => {
    const result = splitParticipantSuggestions(["Alex Chen", "Alex Chen"], people);

    expect(result.suggestedExisting).toHaveLength(1);
    expect(result.suggestedNewNames).toEqual([]);
  });
});

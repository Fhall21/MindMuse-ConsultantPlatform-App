import { describe, expect, it } from "vitest";
import { aiPreferencesSchema } from "@/lib/validations/ai-preferences";

const validPayload = {
  consultationTypes: [],
  focusAreas: [],
  excludedTopics: [],
  emailGuidance: "",
  anonymousMode: false,
};

describe("aiPreferencesSchema", () => {
  it("trims and preserves the industry field", () => {
    const parsed = aiPreferencesSchema.parse({
      ...validPayload,
      industry: "  Organisational psychology  ",
    });

    expect(parsed.industry).toBe("Organisational psychology");
  });

  it("rejects industry values over 150 characters", () => {
    const parsed = aiPreferencesSchema.safeParse({
      ...validPayload,
      industry: "x".repeat(151),
    });

    expect(parsed.success).toBe(false);
  });
});

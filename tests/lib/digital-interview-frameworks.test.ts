import { describe, expect, it } from "vitest";
import {
  DIGITAL_INTERVIEW_FRAMEWORK_CATEGORY_LABELS,
  DIGITAL_INTERVIEW_FRAMEWORKS,
} from "@/lib/digital-interview-frameworks";
import { digitalInterviewFrameworkSchema } from "@/lib/data/digital-interviews";

describe("digital interview framework registry", () => {
  it("covers the prompt catalog and applicability groups", () => {
    expect(DIGITAL_INTERVIEW_FRAMEWORKS.length).toBeGreaterThan(10);
    expect(DIGITAL_INTERVIEW_FRAMEWORKS.some((framework) => framework.id === "care")).toBe(true);
    expect(
      DIGITAL_INTERVIEW_FRAMEWORKS.some((framework) => framework.id === "psychological_safety")
    ).toBe(true);
    expect(DIGITAL_INTERVIEW_FRAMEWORK_CATEGORY_LABELS.group_facilitation).toBe("Group Facilitation");
  });

  it("accepts every registered framework id", () => {
    for (const framework of DIGITAL_INTERVIEW_FRAMEWORKS) {
      expect(digitalInterviewFrameworkSchema.safeParse(framework.id).success).toBe(true);
    }
  });
});
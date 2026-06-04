import { describe, expect, it } from "vitest";
import {
  buildEvidenceEmailGuidancePrefill,
  extractEvidenceEmailRevisionRequest,
} from "@/lib/chat/email-guidance-prefill";

describe("email guidance prefill", () => {
  it("does not treat initial draft requests as revision guidance", () => {
    expect(extractEvidenceEmailRevisionRequest("let's draft an email for this meeting")).toBe("");
    expect(extractEvidenceEmailRevisionRequest("draft an evidence email for Chris")).toBe("");
  });

  it("extracts follow-up edit requests", () => {
    expect(extractEvidenceEmailRevisionRequest("make the email shorter")).toBe(
      "make the email shorter"
    );
  });

  it("interprets concise edit requests into settings guidance copy", () => {
    expect(buildEvidenceEmailGuidancePrefill("make the email shorter")).toBe(
      "Make the evidence email shorter and more concise."
    );
  });
});

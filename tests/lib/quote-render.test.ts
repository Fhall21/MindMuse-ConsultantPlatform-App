import { describe, it, expect } from "vitest";
import { renderQuote } from "@/lib/quote-render";
import type { ReportRenderPolicy } from "@/lib/report-render-policy";

function makePolicy(anonymousMode: boolean): ReportRenderPolicy {
  return {
    anonymousMode,
    maskText: (value: string) =>
      anonymousMode ? value.replace(/Alice/g, "[redacted]") : value,
    maskPeople: (people) => people.map((p) => (anonymousMode ? "[redacted]" : p)),
    maskConsultationTitle: (title) => (anonymousMode ? "Consultation" : title),
  };
}

describe("renderQuote", () => {
  const baseInput = {
    exactText: "Alice said the policy was unclear.",
    speakerLabel: "Alice Smith",
    workGroupLabel: "Team A",
    riskFlag: false,
  };

  it("renders verbatim when anonymous mode is off", () => {
    const policy = makePolicy(false);
    const result = renderQuote(
      { ...baseInput, anonymousMaskRule: "role_workgroup" },
      policy
    );
    expect(result.text).toBe(baseInput.exactText);
    expect(result.attribution).toBe("Alice Smith");
    expect(result.masked).toBe(false);
  });

  it("renders verbatim when mask rule is 'none' even in anonymous mode", () => {
    const policy = makePolicy(true);
    const result = renderQuote(
      { ...baseInput, anonymousMaskRule: "none" },
      policy
    );
    expect(result.text).toBe(baseInput.exactText);
    expect(result.masked).toBe(false);
  });

  it("redacts text fully when mask rule is 'redact'", () => {
    const policy = makePolicy(true);
    const result = renderQuote(
      { ...baseInput, anonymousMaskRule: "redact" },
      policy
    );
    expect(result.text).toContain("Redacted");
    expect(result.attribution).toBe("Team A");
    expect(result.masked).toBe(true);
  });

  it("masks attribution but keeps speech under 'role_workgroup'", () => {
    const policy = makePolicy(true);
    const result = renderQuote(
      { ...baseInput, anonymousMaskRule: "role_workgroup" },
      policy
    );
    expect(result.text).toContain("[redacted]");
    expect(result.attribution).toBe("Team A");
    expect(result.masked).toBe(true);
  });

  it("falls back to a generic attribution when no work group is captured", () => {
    const policy = makePolicy(true);
    const result = renderQuote(
      {
        ...baseInput,
        workGroupLabel: null,
        anonymousMaskRule: "role_workgroup",
      },
      policy
    );
    expect(result.attribution).toBe("Anonymous participant");
  });

  it("propagates riskFlag through the render output", () => {
    const policy = makePolicy(true);
    const result = renderQuote(
      { ...baseInput, riskFlag: true, anonymousMaskRule: "redact" },
      policy
    );
    expect(result.riskFlagged).toBe(true);
  });
});

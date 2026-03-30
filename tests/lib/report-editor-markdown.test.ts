import { describe, expect, it } from "vitest";

import {
  normalizeReportHeadingText,
  normalizeReportMarkdownForEditor,
  normalizeReportMarkdownForStorage,
} from "@/lib/report-editor-markdown";

describe("lib/report-editor-markdown - normalizeReportMarkdownForEditor", () => {
  it("converts plain report section labels into markdown headings", () => {
    const input = [
      "Executive Summary",
      "This report outlines the findings.",
      "",
      "Accepted Round Themes",
      "Workload and Stress Management",
      "This theme focuses on workload.",
    ].join("\n");

    expect(normalizeReportMarkdownForEditor(input)).toBe([
      "## Executive Summary",
      "",
      "This report outlines the findings.",
      "",
      "## Accepted Round Themes",
      "",
      "### Workload and Stress Management",
      "",
      "This theme focuses on workload.",
    ].join("\n"));
  });

  it("turns supporting consultation evidence rows into bullets", () => {
    const input = [
      "Supporting Consultation-Level Evidence Themes",
      "Workplace Stress and Sources (Sam chat): Sam described fatigue due to workload.",
      "Communication and Clarity Issues (Sam chat): Frustration over changing priorities.",
    ].join("\n");

    expect(normalizeReportMarkdownForEditor(input)).toBe([
      "## Supporting Consultation-Level Evidence Themes",
      "",
      "- Workplace Stress and Sources (Sam chat): Sam described fatigue due to workload.",
      "- Communication and Clarity Issues (Sam chat): Frustration over changing priorities.",
    ].join("\n"));
  });

  it("turns follow-up considerations into bullets", () => {
    const input = [
      "Key Follow-Up or Monitoring Considerations",
      "Regular check-ins to monitor stress levels and workload perceptions across teams.",
      "Encouraging breaks during work hours might improve morale.",
    ].join("\n");

    expect(normalizeReportMarkdownForEditor(input)).toBe([
      "## Key Follow-Up or Monitoring Considerations",
      "",
      "- Regular check-ins to monitor stress levels and workload perceptions across teams.",
      "- Encouraging breaks during work hours might improve morale.",
    ].join("\n"));
  });

  it("preserves content that is already markdown", () => {
    const input = [
      "## Executive Summary",
      "",
      "- Already a bullet",
      "### Existing Subheading",
    ].join("\n");

    expect(normalizeReportMarkdownForEditor(input)).toBe(input);
  });

  it("cleans heading formatting artifacts from editor-exported markdown before storage", () => {
    const input = [
      "## **Key Themes**&#x20;",
      "### __Workload and Stress__&nbsp;",
      "- Bullet stays intact",
    ].join("\n");

    expect(normalizeReportMarkdownForStorage(input)).toBe([
      "## Key Themes",
      "### Workload and Stress",
      "- Bullet stays intact",
    ].join("\n"));
  });

  it("normalizes malformed markdown headings when loading back into the editor", () => {
    const input = [
      "## **Key Themes**&#x20;",
      "### __Team Dynamics__",
    ].join("\n");

    expect(normalizeReportMarkdownForEditor(input)).toBe([
      "## Key Themes",
      "### Team Dynamics",
    ].join("\n"));
  });

  it("strips presentational emphasis from heading text", () => {
    expect(normalizeReportHeadingText("**Key Themes**&#x20;")).toBe("Key Themes");
    expect(normalizeReportHeadingText("__Team Dynamics__")).toBe("Team Dynamics");
  });
});
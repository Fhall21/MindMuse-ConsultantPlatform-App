export interface StructuredReportSubsection {
  heading: string;
  paragraphs?: string[];
  bullet_points?: string[];
}

export interface StructuredReportOutlineSection {
  heading: string;
  purpose?: string | null;
  prose_guidance?: string | null;
  depth?: "brief" | "detailed";
  section_note?: string | null;
}

export interface StructuredReportOutline {
  sections: StructuredReportOutlineSection[];
}

export interface StructuredReportSection {
  heading: string;
  paragraphs?: string[];
  bullet_points?: string[];
  subsections?: StructuredReportSubsection[];
}

export interface StructuredReportDocument {
  sections?: StructuredReportSection[];
}

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function pushLine(lines: string[], line = "") {
  if (line === "" && (lines.length === 0 || lines[lines.length - 1] === "")) {
    return;
  }
  lines.push(line);
}

export function renderStructuredReportDocumentMarkdown(
  document: StructuredReportDocument
): string {
  const lines: string[] = [];

  for (const section of document.sections ?? []) {
    const heading = cleanText(section.heading ?? "");
    if (!heading) continue;

    pushLine(lines, `## ${heading}`);
    pushLine(lines);

    for (const paragraph of section.paragraphs ?? []) {
      const text = cleanText(paragraph);
      if (!text) continue;
      pushLine(lines, text);
      pushLine(lines);
    }

    for (const bullet of section.bullet_points ?? []) {
      const text = cleanText(bullet);
      if (!text) continue;
      pushLine(lines, `- ${text}`);
    }

    if ((section.bullet_points ?? []).length > 0) {
      pushLine(lines);
    }

    for (const subsection of section.subsections ?? []) {
      const subheading = cleanText(subsection.heading ?? "");
      if (!subheading) continue;

      pushLine(lines, `### ${subheading}`);
      pushLine(lines);

      for (const paragraph of subsection.paragraphs ?? []) {
        const text = cleanText(paragraph);
        if (!text) continue;
        pushLine(lines, text);
        pushLine(lines);
      }

      for (const bullet of subsection.bullet_points ?? []) {
        const text = cleanText(bullet);
        if (!text) continue;
        pushLine(lines, `- ${text}`);
      }

      if ((subsection.bullet_points ?? []).length > 0) {
        pushLine(lines);
      }
    }
  }

  while (lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.join("\n");
}

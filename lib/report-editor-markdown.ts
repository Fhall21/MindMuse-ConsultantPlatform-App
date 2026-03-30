const SECTION_HEADING_LABELS = new Set([
  "executive summary",
  "accepted round themes",
  "supporting consultation-level evidence themes",
  "supporting consultation themes",
  "key follow-up or monitoring considerations",
]);

type SectionKind = "executive" | "accepted" | "supporting" | "follow-up" | null;

function isMarkdownLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("# ") ||
    trimmed.startsWith("## ") ||
    trimmed.startsWith("### ") ||
    trimmed.startsWith("- ") ||
    trimmed.startsWith("* ") ||
    trimmed.startsWith("> ") ||
    /^\d+\.\s/.test(trimmed)
  );
}

function sectionFromHeading(line: string): SectionKind {
  const normalized = line
    .replace(/^#+\s*/, "")
    .replace(/:$/, "")
    .trim()
    .toLowerCase();

  switch (normalized) {
    case "executive summary":
      return "executive";
    case "accepted round themes":
      return "accepted";
    case "supporting consultation-level evidence themes":
    case "supporting consultation themes":
      return "supporting";
    case "key follow-up or monitoring considerations":
      return "follow-up";
    default:
      return null;
  }
}

function getNextNonEmptyLine(lines: string[], startIndex: number): string | null {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const trimmed = lines[index]?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function isLikelyThemeSubheading(line: string, nextLine: string | null): boolean {
  if (!nextLine) return false;

  const trimmed = line.trim();

  if (
    !trimmed ||
    trimmed.length > 90 ||
    trimmed.includes(":") ||
    /[.!?]$/.test(trimmed) ||
    SECTION_HEADING_LABELS.has(trimmed.toLowerCase())
  ) {
    return false;
  }

  return !isMarkdownLine(nextLine) && !SECTION_HEADING_LABELS.has(nextLine.toLowerCase());
}

function pushLine(output: string[], line: string) {
  if (line === "" && output[output.length - 1] === "") {
    return;
  }
  output.push(line);
}

export function normalizeReportMarkdownForEditor(content: string): string {
  if (!content.trim()) return content;

  const lines = content.split("\n");
  const output: string[] = [];
  let currentSection: SectionKind = null;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const trimmed = rawLine.trim();

    if (!trimmed) {
      pushLine(output, "");
      continue;
    }

    if (isMarkdownLine(trimmed)) {
      currentSection = sectionFromHeading(trimmed) ?? currentSection;
      pushLine(output, trimmed);
      continue;
    }

    const plainSection = sectionFromHeading(trimmed);
    if (plainSection) {
      currentSection = plainSection;
      if (output.length > 0 && output[output.length - 1] !== "") {
        pushLine(output, "");
      }
      pushLine(output, `## ${trimmed.replace(/:$/, "")}`);
      pushLine(output, "");
      continue;
    }

    const nextLine = getNextNonEmptyLine(lines, index);

    if (currentSection === "accepted" && isLikelyThemeSubheading(trimmed, nextLine)) {
      if (output.length > 0 && output[output.length - 1] !== "") {
        pushLine(output, "");
      }
      pushLine(output, `### ${trimmed}`);
      pushLine(output, "");
      continue;
    }

    if (currentSection === "supporting" && trimmed.includes(": ")) {
      pushLine(output, `- ${trimmed}`);
      continue;
    }

    if (currentSection === "follow-up") {
      pushLine(output, `- ${trimmed}`);
      continue;
    }

    pushLine(output, trimmed);
  }

  while (output[output.length - 1] === "") {
    output.pop();
  }

  return output.join("\n");
}
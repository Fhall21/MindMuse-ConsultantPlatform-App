/**
 * Markdown serialiser for report exports.
 *
 * Converts an ExportSection[] into a .md string with YAML frontmatter,
 * preserving all block types faithfully.
 *
 * Bold/italic markers (**text**, _text_) in prose are passed through as-is —
 * they are already valid markdown and must not be escaped.
 */

import type { ContentBlock } from "@/lib/report-content-blocks";
import type {
  ExportSection,
  ExportTheme,
  ExportConsultation,
  ExportAuditEvent,
  ExportSectionData,
} from "@/lib/report-export-content";
import { formatDate } from "@/lib/report-formatting";

const artifactTypeLabels: Record<string, string> = {
  summary: "Consultation Summary",
  report: "Board-Pack Report",
  email: "Evidence Email",
};

// ─── Block serialisation ──────────────────────────────────────────────────────

function serializeBlock(block: ContentBlock): string {
  switch (block.type) {
    case "heading1":
      return `# ${block.text}`;
    case "heading2":
      return `## ${block.text}`;
    case "heading3":
      return `### ${block.text}`;
    case "prose":
      return block.text;
    case "bullet":
      return block.items.map((item) => `- ${item}`).join("\n");
    case "numbered":
      return block.items.map((item, i) => `${i + 1}. ${item}`).join("\n");
  }
}

// ─── Structured data serialisation ───────────────────────────────────────────

function serializeThemes(themes: ExportTheme[]): string {
  const lines: string[] = [];
  for (const theme of themes) {
    const statusBadge =
      theme.status === "accepted"
        ? ""
        : theme.status === "draft"
          ? " _(pending review)_"
          : " _(rejected)_";
    lines.push(`**${theme.label}**${statusBadge}`);
    if (theme.description) {
      lines.push(theme.description);
    }
    if (theme.memberCount > 0) {
      lines.push(`_${theme.memberCount} supporting insight${theme.memberCount === 1 ? "" : "s"}_`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function serializeConsultations(consultations: ExportConsultation[]): string {
  const lines: string[] = [];
  for (const c of consultations) {
    lines.push(`**${c.title}**`);
    if (c.date) {
      lines.push(`_${new Date(c.date).toLocaleDateString("en-GB", { dateStyle: "long" })}_`);
    }
    if (c.people.length > 0) {
      lines.push(`Attendees: ${c.people.join(", ")}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function serializeAuditEvents(events: ExportAuditEvent[]): string {
  const lines: string[] = [];
  for (const event of events) {
    const dateStr = new Date(event.createdAt).toLocaleDateString("en-GB", {
      dateStyle: "medium",
    });
    const countSuffix = event.count > 1 ? ` (×${event.count})` : "";
    lines.push(`- **${event.label}**${countSuffix} — ${dateStr}`);
  }
  return lines.join("\n");
}

function serializeSectionData(data: ExportSectionData): string {
  switch (data.kind) {
    case "themes":
      return serializeThemes(data.themes);
    case "evidence":
      return serializeConsultations(data.consultations);
    case "audit":
      return serializeAuditEvents(data.events);
  }
}

// ─── Main serialiser ──────────────────────────────────────────────────────────

export interface MarkdownExportOptions {
  id: string;
  title: string | null;
  roundLabel: string;
  generatedAt: string;
  artifactType: string;
  sections: ExportSection[];
}

/**
 * Serialise export sections to a GitHub-flavored Markdown string.
 * Includes YAML frontmatter and horizontal-rule section separators.
 */
export function serializeToMarkdown(opts: MarkdownExportOptions): string {
  const { id, title, roundLabel, generatedAt, artifactType, sections } = opts;
  const typeLabel = artifactTypeLabels[artifactType] ?? artifactType;

  const parts: string[] = [];

  // ── YAML frontmatter ──
  parts.push(
    [
      "---",
      `title: "${(title ?? "Untitled Report").replace(/"/g, '\\"')}"`,
      `round: "${roundLabel.replace(/"/g, '\\"')}"`,
      `type: "${typeLabel}"`,
      `generated: "${formatDate(generatedAt)}"`,
      `id: "${id}"`,
      "confidential: true",
      "---",
    ].join("\n")
  );

  // ── Sections ──
  for (const section of sections) {
    const sectionParts: string[] = [];

    if (section.isPageBreak) {
      sectionParts.push("---");
    }

    if (section.heading) {
      sectionParts.push(`# ${section.heading}`);
    }

    // Content blocks
    for (const block of section.blocks) {
      sectionParts.push(serializeBlock(block));
    }

    // Structured data
    if (section.data) {
      const dataStr = serializeSectionData(section.data);
      if (dataStr) {
        sectionParts.push(dataStr);
      }
    }

    if (sectionParts.length > 0) {
      parts.push(sectionParts.join("\n\n"));
    }
  }

  return parts.join("\n\n");
}

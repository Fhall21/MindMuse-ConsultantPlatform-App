/**
 * Shared content model for Markdown and Word (.docx) report exports.
 *
 * Converts a ReportArtifactDetail into an ordered list of ExportSection objects
 * that both the markdown serialiser and the docx builder can consume.
 *
 * Data flow:
 *
 *   report.content (markdown string)
 *        │
 *        ▼
 *   parseContentBlocks()  ──→  ContentBlock[]
 *        │
 *        ▼  split on heading1 boundaries
 *   ExportSection[] (preamble + content sections)
 *        │
 *        ▼  append structured data sections
 *   ExportSection[] (+ themes, evidence, audit)
 */

import type { ReportArtifactDetail, ConsultationMeta } from "@/lib/actions/reports";
import { parseContentBlocks, type ContentBlock } from "@/lib/report-content-blocks";
import {
  getAllThemeGroups,
  type AllThemeGroupSnapshot,
} from "@/lib/report-graph";
import {
  filterMajorEvents,
  clusterAuditEvents,
  buildReportEventLabel,
  type AuditCluster,
} from "@/lib/report-audit";

export type ReportTemplate = "standard" | "executive";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExportTheme {
  label: string;
  description: string | null;
  status: "accepted" | "draft" | "rejected";
  memberCount: number;
}

export interface ExportConsultation {
  title: string;
  date: string;
  people: string[];
}

export interface ExportAuditEvent {
  label: string;
  count: number;
  createdAt: string;
}

export type ExportSectionData =
  | { kind: "themes"; themes: ExportTheme[] }
  | { kind: "evidence"; consultations: ExportConsultation[] }
  | { kind: "audit"; events: ExportAuditEvent[] };

export interface ExportSection {
  /** Section heading. null for the preamble (content before the first # heading). */
  heading: string | null;
  /** Parsed content blocks — may be empty for structured data sections. */
  blocks: ContentBlock[];
  /** True for heading1 section boundaries and all appended structured data sections. */
  isPageBreak: boolean;
  /** Structured data payload for themes, evidence, and audit sections. */
  data?: ExportSectionData;
}

// ─── Content splitting ────────────────────────────────────────────────────────

/**
 * Parse report.content and split on heading1 blocks into ExportSections.
 * Blocks before the first heading1 form an unnamed preamble section.
 */
function splitContentIntoSections(content: string): ExportSection[] {
  const blocks = parseContentBlocks(content);
  const sections: ExportSection[] = [];

  let currentHeading: string | null = null;
  let currentBlocks: ContentBlock[] = [];
  let isFirst = true;

  for (const block of blocks) {
    if (block.type === "heading1") {
      // Flush previous section
      if (isFirst) {
        // Everything before the first heading1 is the preamble
        if (currentBlocks.length > 0) {
          sections.push({ heading: null, blocks: currentBlocks, isPageBreak: false });
        }
        isFirst = false;
      } else {
        sections.push({
          heading: currentHeading,
          blocks: currentBlocks,
          isPageBreak: true,
        });
      }
      currentHeading = block.text;
      currentBlocks = [];
    } else {
      currentBlocks.push(block);
    }
  }

  // Flush the last section
  if (isFirst) {
    // No heading1 found at all — single unnamed section
    if (currentBlocks.length > 0) {
      sections.push({ heading: null, blocks: currentBlocks, isPageBreak: false });
    }
  } else {
    sections.push({
      heading: currentHeading,
      blocks: currentBlocks,
      isPageBreak: true,
    });
  }

  return sections;
}

// ─── Structured data sections ─────────────────────────────────────────────────

function buildThemeSection(
  allGroups: AllThemeGroupSnapshot[],
  template: ReportTemplate
): ExportSection | null {
  const accepted = allGroups.filter((g) => g.status === "accepted");
  const pending = allGroups.filter((g) => g.status === "draft");

  const themesToShow = template === "executive" ? accepted.slice(0, 3) : accepted;
  const showPending = template === "standard";

  const themes: ExportTheme[] = [
    ...themesToShow.map((g) => ({
      label: g.label,
      description: g.description,
      status: "accepted" as const,
      memberCount: g.members.length,
    })),
    ...(showPending
      ? pending.map((g) => ({
          label: g.label,
          description: g.description,
          status: "draft" as const,
          memberCount: g.members.length,
        }))
      : []),
  ];

  if (themes.length === 0) return null;

  return {
    heading: "Key Themes",
    blocks: [],
    isPageBreak: true,
    data: { kind: "themes", themes },
  };
}

function buildRejectedThemesSection(
  allGroups: AllThemeGroupSnapshot[]
): ExportSection | null {
  const rejected = allGroups.filter((g) => g.status === "management_rejected");
  if (rejected.length === 0) return null;

  return {
    heading: "Rejected Themes",
    blocks: [],
    isPageBreak: true,
    data: {
      kind: "themes",
      themes: rejected.map((g) => ({
        label: g.label,
        description: g.description,
        status: "rejected" as const,
        memberCount: g.members.length,
      })),
    },
  };
}

function buildEvidenceSection(
  report: ReportArtifactDetail
): ExportSection | null {
  const consultations: ExportConsultation[] =
    report.consultations.length > 0
      ? report.consultations.map((c: ConsultationMeta) => ({
          title: c.title,
          date: c.date,
          people: c.people,
        }))
      : report.consultationTitles.map((title) => ({
          title,
          date: "",
          people: [],
        }));

  if (consultations.length === 0) return null;

  return {
    heading: "Source Evidence",
    blocks: [],
    isPageBreak: true,
    data: { kind: "evidence", consultations },
  };
}

function buildAuditSection(
  report: ReportArtifactDetail
): ExportSection | null {
  const major = filterMajorEvents(report.auditSummary ?? []);
  const clusters: AuditCluster[] = clusterAuditEvents(major);

  if (clusters.length === 0) return null;

  return {
    heading: "Audit Trail",
    blocks: [],
    isPageBreak: true,
    data: {
      kind: "audit",
      events: clusters.map((c) => ({
        label: buildReportEventLabel(c.action),
        count: c.count,
        createdAt: c.createdAt,
      })),
    },
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Build an ordered list of ExportSections from a ReportArtifactDetail.
 *
 * Section order:
 *   1. Content sections (preamble + heading1-split sections from report.content)
 *   2. Key Themes (from inputSnapshot)
 *   3. Rejected Themes (standard template only, if any)
 *   4. Source Evidence
 *   5. Audit Trail (if any events)
 */
export function buildExportSections(
  report: ReportArtifactDetail,
  template: ReportTemplate
): ExportSection[] {
  const sections: ExportSection[] = [];

  // 1. Parse report.content into sections
  sections.push(...splitContentIntoSections(report.content));

  const allGroups = getAllThemeGroups(report.inputSnapshot);

  // 2. Key Themes
  const themeSection = buildThemeSection(allGroups, template);
  if (themeSection) sections.push(themeSection);

  // 3. Rejected Themes (standard only)
  if (template === "standard") {
    const rejectedSection = buildRejectedThemesSection(allGroups);
    if (rejectedSection) sections.push(rejectedSection);
  }

  // 4. Source Evidence
  const evidenceSection = buildEvidenceSection(report);
  if (evidenceSection) sections.push(evidenceSection);

  // 5. Audit Trail
  const auditSection = buildAuditSection(report);
  if (auditSection) sections.push(auditSection);

  return sections;
}

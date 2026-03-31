import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import {
  buildReportGraphModel,
  formatConnectionTypeLabel,
  getAllThemeGroups,
  type ReportGraphModel,
} from "@/lib/report-graph";
import {
  buildComplianceAuditTrail,
  hasComplianceAuditTrailContent,
} from "@/lib/report-audit";
import { parseContentBlocks } from "@/lib/report-content-blocks";
import type { ReportArtifactDetail } from "@/types/report-artifact";

// ─── Types ───────────────────────────────────────────────────────────────────

type ReportTemplate = "standard" | "executive";

export interface TocPageNumbers {
  executiveSummary?: number;
  keyThemes?: number;
  rejectedThemes?: number;
  network?: number;
  evidence?: number;
  auditTrail?: number;
}

export interface SectionElement {
  id: keyof TocPageNumbers;
  label: string;
  element: React.ReactElement;
}

interface ReportPrintLayoutProps {
  report: ReportArtifactDetail;
  template: ReportTemplate;
  tocPageNumbers?: TocPageNumbers;
}

// ─── Colors ──────────────────────────────────────────────────────────────────

const colors = {
  black: "#111827",
  dark: "#1f2937",
  mid: "#4b5563",
  light: "#6b7280",
  faint: "#9ca3af",
  border: "#e5e7eb",
  borderLight: "#f3f4f6",
  emerald: "#059669",
  emeraldBg: "#ecfdf5",
  emeraldBorder: "#a7f3d0",
  slateBorder: "#cbd5e1",
  slateBg: "#f8fafc",
  white: "#ffffff",
};

const connectionPalette: Record<
  string,
  { accent: string; background: string; border: string }
> = {
  related_to: {
    accent: "#6b7280",
    background: "#f9fafb",
    border: "#d1d5db",
  },
  supports: {
    accent: "#059669",
    background: "#ecfdf5",
    border: "#a7f3d0",
  },
  contradicts: {
    accent: "#dc2626",
    background: "#fef2f2",
    border: "#fecaca",
  },
  escalates: {
    accent: "#7c3aed",
    background: "#f5f3ff",
    border: "#c4b5fd",
  },
  resolves: {
    accent: "#0284c7",
    background: "#eff6ff",
    border: "#93c5fd",
  },
  involves: {
    accent: "#475569",
    background: "#f8fafc",
    border: "#cbd5e1",
  },
};

// ─── Content page style (exported for two-pass page counting in route.tsx) ───

export const CONTENT_PAGE_STYLE = {
  fontFamily: "Times-Roman" as const,
  fontSize: 10,
  lineHeight: 1.6,
  color: colors.dark,
  paddingTop: 60,
  paddingBottom: 70,
  paddingHorizontal: 50,
  backgroundColor: colors.white,
};

// ─── StyleSheet ──────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: CONTENT_PAGE_STYLE,

  // ── Running header ─────────────────────────────────────────────────────────
  header: {
    position: "absolute",
    top: 24,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    paddingBottom: 7,
  },
  headerLeft: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: colors.faint,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  headerRight: {
    fontFamily: "Helvetica",
    fontSize: 7,
    color: colors.faint,
  },

  // ── Running footer ─────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 28,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingTop: 7,
  },
  footerText: {
    fontFamily: "Helvetica",
    fontSize: 7,
    color: colors.faint,
  },
  confidentialStamp: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: colors.faint,
    textTransform: "uppercase",
    letterSpacing: 2,
  },

  // ── Title page ─────────────────────────────────────────────────────────────
  titlePageContent: {
    flex: 1,
    flexDirection: "column",
    paddingHorizontal: 50,
    paddingBottom: 50,
  },
  titlePageRoundLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: colors.emerald,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 20,
    marginTop: 60,
  },
  titlePageTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 28,
    color: colors.black,
    lineHeight: 1.2,
    marginBottom: 10,
  },
  titlePageSubtitle: {
    fontFamily: "Helvetica",
    fontSize: 11,
    color: colors.mid,
    lineHeight: 1.5,
    marginBottom: 24,
  },
  titlePageMeta: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: colors.light,
  },
  confidentialLarge: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: colors.faint,
    textTransform: "uppercase",
    letterSpacing: 3,
    marginBottom: 4,
  },
  confidentialNote: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: colors.faint,
    textAlign: "center",
  },

  // ── TOC ────────────────────────────────────────────────────────────────────
  tocHeading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: colors.light,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 20,
  },
  tocRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 10,
  },
  tocLabel: {
    fontFamily: "Helvetica",
    fontSize: 11,
    color: colors.dark,
  },
  tocDots: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    marginHorizontal: 8,
    marginBottom: 3,
  },
  tocPage: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: colors.dark,
    minWidth: 16,
    textAlign: "right",
  },

  // ── Section headings ───────────────────────────────────────────────────────
  sectionHeading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: colors.black,
    marginBottom: 12,
    marginTop: 4,
  },
  sectionSubheading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: colors.light,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 10,
  },

  // ── Content blocks ─────────────────────────────────────────────────────────
  paragraph: {
    marginBottom: 10,
    textAlign: "justify",
  },
  h1: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    color: colors.black,
    marginTop: 16,
    marginBottom: 8,
  },
  h2: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    color: colors.dark,
    marginTop: 14,
    marginBottom: 6,
  },
  h3: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: colors.mid,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 4,
  },
  bulletList: {
    marginBottom: 10,
    paddingLeft: 4,
  },
  bulletItem: {
    flexDirection: "row",
    marginBottom: 4,
  },
  bulletDot: {
    width: 12,
    fontSize: 10,
    color: colors.emerald,
  },
  bulletText: {
    flex: 1,
  },
  numberedItem: {
    flexDirection: "row",
    marginBottom: 4,
  },
  numberedIndex: {
    fontFamily: "Helvetica-Bold",
    width: 16,
    fontSize: 10,
    color: colors.mid,
  },

  // ── Dividers ───────────────────────────────────────────────────────────────
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    marginVertical: 16,
  },
  dividerAccent: {
    borderBottomWidth: 2,
    borderBottomColor: colors.emerald,
    width: 40,
    marginBottom: 20,
  },

  // ── Stats ──────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 10,
    backgroundColor: colors.slateBg,
  },
  statLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: colors.light,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 3,
  },
  statValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    color: colors.black,
  },

  // ── Theme cards ────────────────────────────────────────────────────────────
  themeCard: {
    borderWidth: 0.5,
    borderColor: colors.emeraldBorder,
    borderLeftWidth: 3,
    borderLeftColor: colors.emerald,
    borderRadius: 3,
    backgroundColor: colors.emeraldBg,
    padding: 10,
    marginBottom: 6,
  },
  themeCardMuted: {
    borderColor: colors.border,
    borderLeftColor: colors.slateBorder,
    backgroundColor: colors.slateBg,
  },
  themeLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    color: colors.dark,
    marginBottom: 2,
  },
  themeBadge: {
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    color: colors.emerald,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginLeft: 6,
  },
  themeBadgeMuted: {
    color: colors.light,
  },
  themeDescription: {
    fontFamily: "Times-Roman",
    fontSize: 9,
    color: colors.mid,
    lineHeight: 1.5,
  },
  themeLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },

  // ── Evidence cards ─────────────────────────────────────────────────────────
  evidenceCard: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 3,
    padding: 10,
    marginBottom: 5,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  // View wrapper for the number so borderRadius clips correctly
  evidenceNumberBox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    flexShrink: 0,
  },
  evidenceNumberText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: colors.light,
  },
  evidenceTitle: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: colors.dark,
    lineHeight: 1.35,
  },
  evidenceCardBody: {
    flex: 1,
  },
  metaStack: {
    marginTop: 4,
  },
  metaLine: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: colors.mid,
    lineHeight: 1.45,
    marginBottom: 2,
  },
  metaLabel: {
    fontFamily: "Helvetica-Bold",
    color: colors.light,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  // ── Connection groups ─────────────────────────────────────────────────────
  connectionGroupCard: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.slateBg,
    padding: 10,
    marginBottom: 10,
  },
  connectionGroupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  connectionGroupTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  connectionGroupCountBox: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: colors.white,
  },
  connectionGroupCountText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: colors.mid,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  connectionCard: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.white,
    padding: 10,
    marginBottom: 6,
  },
  connectionCardLast: {
    marginBottom: 0,
  },
  connectionCardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  connectionTypeBox: {
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  connectionTypeText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  connectionOriginText: {
    fontFamily: "Helvetica",
    fontSize: 7.5,
    color: colors.faint,
  },
  connectionFlow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  connectionFlowRail: {
    width: 18,
    alignItems: "center",
    paddingTop: 2,
  },
  connectionFlowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connectionFlowLine: {
    width: 1,
    flex: 1,
    marginVertical: 3,
  },
  connectionFlowArrow: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  connectionFlowBody: {
    flex: 1,
  },
  connectionEndpointBlock: {
    marginBottom: 8,
  },
  connectionEndpointLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    color: colors.light,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  connectionEndpointValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: colors.dark,
    lineHeight: 1.35,
  },
  connectionNotes: {
    fontFamily: "Times-Roman",
    fontSize: 8.5,
    color: colors.mid,
    lineHeight: 1.45,
  },

  // ── Audit rail ─────────────────────────────────────────────────────────────
  railDayRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 5,
  },
  railDayLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: colors.mid,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginRight: 8,
    flexShrink: 0,
  },
  railDayLine: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  railEventRow: {
    flexDirection: "row",
    paddingLeft: 4,
    marginBottom: 4,
    alignItems: "flex-start",
  },
  railEventBody: {
    flex: 1,
    paddingBottom: 3,
  },
  railDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.faint,
    marginTop: 4,
    marginRight: 8,
    flexShrink: 0,
  },
  railEventText: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: colors.dark,
    lineHeight: 1.35,
  },
  railEntityText: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: colors.faint,
    marginTop: 2,
    lineHeight: 1.35,
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const artifactTypeLabels: Record<string, string> = {
  summary: "Consultation Summary",
  report: "Board-Pack Report",
  email: "Evidence Email",
};

function formatPdfDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(date);
}

function formatPdfMediumDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-US", { dateStyle: "medium" });
}

function renderPdfInlineContent(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Text key={i} style={{ fontFamily: "Helvetica-Bold" }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return part;
  });
}

function PdfMetaLine({ label, value }: { label: string; value: string }) {
  return (
    <Text style={s.metaLine}>
      <Text style={s.metaLabel}>{label}: </Text>
      {value}
    </Text>
  );
}

function PdfConnectionCard({
  connection,
  groupLabel,
}: {
  connection: ReportGraphModel["connectionsByType"][number]["connections"][number];
  groupLabel: string;
}) {
  const palette =
    connectionPalette[connection.connectionType] ?? connectionPalette.related_to;

  return (
    <View style={s.connectionCard} wrap={false}>
      <View style={s.connectionCardTopRow}>
        <View
          style={[
            s.connectionTypeBox,
            { backgroundColor: palette.background, borderColor: palette.border },
          ]}
        >
          <Text style={[s.connectionTypeText, { color: palette.accent }]}>
            {groupLabel}
          </Text>
        </View>
        <Text style={s.connectionOriginText}>
          {connection.origin === "ai_suggested" ? "AI accepted" : "Manual"}
        </Text>
      </View>

      <View style={s.connectionFlow}>
        <View style={s.connectionFlowRail}>
          <View
            style={[s.connectionFlowDot, { backgroundColor: palette.accent }]}
          />
          <View
            style={[s.connectionFlowLine, { backgroundColor: palette.border }]}
          />
          <Text style={[s.connectionFlowArrow, { color: palette.accent }]}>
            {"\u2193"}
          </Text>
        </View>

        <View style={s.connectionFlowBody}>
          <View style={s.connectionEndpointBlock}>
            <Text style={s.connectionEndpointLabel}>From</Text>
            <Text style={s.connectionEndpointValue}>{connection.fromLabel}</Text>
          </View>

          <View style={s.connectionEndpointBlock}>
            <Text style={s.connectionEndpointLabel}>To</Text>
            <Text style={s.connectionEndpointValue}>{connection.toLabel}</Text>
          </View>

          {connection.notes ? (
            <Text style={s.connectionNotes}>{connection.notes}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ─── Running header / footer ─────────────────────────────────────────────────

function RunningHeader({
  roundLabel,
  generatedDate,
}: {
  roundLabel: string;
  generatedDate: string;
}) {
  return (
    <View style={s.header} fixed>
      <Text style={s.headerLeft}>{roundLabel}</Text>
      <Text style={s.headerRight}>{generatedDate}</Text>
    </View>
  );
}

function RunningFooter() {
  return (
    <View style={s.footer} fixed>
      <Text
        style={s.footerText}
        render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
      <Text style={s.confidentialStamp}>Confidential</Text>
    </View>
  );
}

// ─── Title page ───────────────────────────────────────────────────────────────

function TitlePage({ report }: { report: ReportArtifactDetail }) {
  const consultationCount =
    report.consultations.length || report.consultationTitles.length;
  const generatedDate = formatPdfDate(report.generatedAt);
  const typeLabel = artifactTypeLabels[report.artifactType] ?? report.artifactType;

  return (
    <Page size="LETTER" style={{ backgroundColor: colors.white }}>
      {/* Emerald accent band */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 8,
          backgroundColor: colors.emerald,
        }}
      />

      {/* Page body */}
      <View style={s.titlePageContent}>
        {/* Top section */}
        <View>
          <Text style={s.titlePageRoundLabel}>{report.roundLabel}</Text>

          <Text style={s.titlePageTitle}>
            {report.title ?? "Untitled Report"}
          </Text>

          {report.roundDescription ? (
            <Text style={s.titlePageSubtitle}>{report.roundDescription}</Text>
          ) : null}

          <View style={s.divider} />

          <View style={{ flexDirection: "row", gap: 16 }}>
            <Text style={s.titlePageMeta}>Generated {generatedDate}</Text>
            <Text style={s.titlePageMeta}>·</Text>
            <Text style={s.titlePageMeta}>
              {consultationCount} consultation{consultationCount !== 1 ? "s" : ""}
            </Text>
            <Text style={s.titlePageMeta}>·</Text>
            <Text style={s.titlePageMeta}>{typeLabel}</Text>
          </View>
        </View>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Confidential notice */}
        <View style={{ alignItems: "center" }}>
          <Text style={s.confidentialLarge}>Confidential</Text>
          <Text style={s.confidentialNote}>
            This document contains privileged and confidential information
            intended solely for the named recipient.
          </Text>
        </View>
      </View>
    </Page>
  );
}

// ─── TOC page ─────────────────────────────────────────────────────────────────

function TocPage({
  roundLabel,
  generatedDate,
  tocPageNumbers,
  sections,
}: {
  roundLabel: string;
  generatedDate: string;
  tocPageNumbers?: TocPageNumbers;
  sections: SectionElement[];
}) {
  return (
    <Page size="LETTER" style={s.page}>
      <RunningHeader roundLabel={roundLabel} generatedDate={generatedDate} />
      <RunningFooter />

      <Text style={s.tocHeading}>Contents</Text>
      <View style={s.dividerAccent} />

      {sections.map(({ id, label }) => (
        <View key={id} style={s.tocRow} wrap={false}>
          <Text style={s.tocLabel}>{label}</Text>
          <View style={s.tocDots} />
          <Text style={s.tocPage}>
            {tocPageNumbers?.[id] != null ? String(tocPageNumbers[id]) : "—"}
          </Text>
        </View>
      ))}
    </Page>
  );
}

// ─── Content blocks renderer ──────────────────────────────────────────────────

function PdfContentBlocks({ content }: { content: string }) {
  const blocks = parseContentBlocks(content);

  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading1":
            return (
              <Text key={i} style={s.h1}>
                {renderPdfInlineContent(block.text)}
              </Text>
            );
          case "heading2":
            return (
              <Text key={i} style={s.h2}>
                {renderPdfInlineContent(block.text)}
              </Text>
            );
          case "heading3":
            return (
              <Text key={i} style={s.h3}>
                {renderPdfInlineContent(block.text)}
              </Text>
            );
          case "bullet":
            return (
              <View key={i} style={s.bulletList}>
                {block.items.map((item, j) => (
                  <View key={j} style={s.bulletItem}>
                    <Text style={s.bulletDot}>{"\u2022"}</Text>
                    <Text style={s.bulletText}>{renderPdfInlineContent(item)}</Text>
                  </View>
                ))}
              </View>
            );
          case "numbered":
            return (
              <View key={i} style={s.bulletList}>
                {block.items.map((item, j) => (
                  <View key={j} style={s.numberedItem}>
                    <Text style={s.numberedIndex}>{j + 1}.</Text>
                    <Text style={s.bulletText}>{renderPdfInlineContent(item)}</Text>
                  </View>
                ))}
              </View>
            );
          default:
            return (
              <Text key={i} style={s.paragraph}>
                {renderPdfInlineContent(block.text)}
              </Text>
            );
        }
      })}
    </>
  );
}

// ─── Section content components (no Page wrapper) ────────────────────────────
// Used both in the full layout and in pass-1 mini-renders for page counting.

function ExecutiveSummaryContent({ content }: { content: string }) {
  return (
    <View>
      <Text style={s.sectionHeading}>Executive Summary</Text>
      <View style={s.dividerAccent} />
      <PdfContentBlocks content={content} />
    </View>
  );
}

function KeyThemesContent({
  report,
  template,
}: {
  report: ReportArtifactDetail;
  template: ReportTemplate;
}) {
  const allGroups = getAllThemeGroups(report.inputSnapshot);
  const accepted = allGroups.filter((g) => g.status === "accepted");
  const pending = allGroups.filter((g) => g.status === "draft");

  const acceptedToShow = template === "executive" ? accepted.slice(0, 3) : accepted;

  return (
    <View>
      <Text style={s.sectionHeading}>
        Key Themes
        {template === "executive" && accepted.length > 3
          ? ` (Top 3 of ${accepted.length})`
          : ` (${accepted.length})`}
      </Text>
      <View style={s.dividerAccent} />

      {acceptedToShow.length === 0 && (
        <Text style={s.themeDescription}>No accepted themes recorded.</Text>
      )}

      {acceptedToShow.map((group, i) => (
        <View key={i}>
          <View style={s.themeCard} wrap={false}>
            <View style={s.themeLabelRow}>
              <Text style={s.themeLabel}>{group.label}</Text>
              <Text style={s.themeBadge}>Accepted</Text>
            </View>
            {group.description && (
              <Text style={s.themeDescription}>{group.description}</Text>
            )}
          </View>
          {group.members.length > 0 && (
            <View style={{ marginLeft: 12, marginTop: 2 }}>
              {[...group.members]
                .sort((a, b) => a.position - b.position)
                .map((member, j) => (
                  <View
                    key={j}
                    style={[s.themeCard, s.themeCardMuted, { marginBottom: 3 }]}
                    wrap={false}
                  >
                    <View style={s.themeLabelRow}>
                      <Text style={s.themeLabel}>{member.label}</Text>
                      {member.sourceConsultationTitle ? (
                        <Text style={[s.themeBadge, s.themeBadgeMuted]}>
                          {member.sourceConsultationTitle}
                        </Text>
                      ) : null}
                    </View>
                    {member.description && (
                      <Text style={s.themeDescription}>{member.description}</Text>
                    )}
                  </View>
                ))}
            </View>
          )}
        </View>
      ))}

      {template === "standard" && pending.length > 0 && (
        <>
          <Text style={s.sectionSubheading}>Pending Review ({pending.length})</Text>
          {pending.map((group, i) => (
            <View key={i}>
              <View style={[s.themeCard, s.themeCardMuted]} wrap={false}>
                <View style={s.themeLabelRow}>
                  <Text style={s.themeLabel}>{group.label}</Text>
                  <Text style={[s.themeBadge, s.themeBadgeMuted]}>Pending</Text>
                </View>
                {group.description && (
                  <Text style={s.themeDescription}>{group.description}</Text>
                )}
              </View>
              {group.members.length > 0 && (
                <View style={{ marginLeft: 12, marginTop: 2 }}>
                  {[...group.members]
                    .sort((a, b) => a.position - b.position)
                    .map((member, j) => (
                      <View
                        key={j}
                        style={[s.themeCard, s.themeCardMuted, { marginBottom: 3 }]}
                        wrap={false}
                      >
                        <View style={s.themeLabelRow}>
                          <Text style={s.themeLabel}>{member.label}</Text>
                          {member.sourceConsultationTitle ? (
                            <Text style={[s.themeBadge, s.themeBadgeMuted]}>
                              {member.sourceConsultationTitle}
                            </Text>
                          ) : null}
                        </View>
                        {member.description && (
                          <Text style={s.themeDescription}>{member.description}</Text>
                        )}
                      </View>
                    ))}
                </View>
              )}
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function RejectedThemesContent({ report }: { report: ReportArtifactDetail }) {
  const allGroups = getAllThemeGroups(report.inputSnapshot);
  const rejected = allGroups.filter((g) => g.status === "management_rejected");

  return (
    <View>
      <Text style={s.sectionHeading}>
        Rejected Themes ({rejected.length})
      </Text>
      <View style={s.dividerAccent} />
      {rejected.map((group, i) => (
        <View key={i}>
          <View style={[s.themeCard, s.themeCardMuted]} wrap={false}>
            <View style={s.themeLabelRow}>
              <Text style={s.themeLabel}>{group.label}</Text>
              <Text style={[s.themeBadge, s.themeBadgeMuted]}>Rejected</Text>
            </View>
            {group.description && (
              <Text style={s.themeDescription}>{group.description}</Text>
            )}
          </View>
          {group.members.length > 0 && (
            <View style={{ marginLeft: 12, marginTop: 2 }}>
              {[...group.members]
                .sort((a, b) => a.position - b.position)
                .map((member, j) => (
                  <View
                    key={j}
                    style={[s.themeCard, s.themeCardMuted, { marginBottom: 3 }]}
                    wrap={false}
                  >
                    <View style={s.themeLabelRow}>
                      <Text style={s.themeLabel}>{member.label}</Text>
                      {member.sourceConsultationTitle ? (
                        <Text style={[s.themeBadge, s.themeBadgeMuted]}>
                          {member.sourceConsultationTitle}
                        </Text>
                      ) : null}
                    </View>
                    {member.description && (
                      <Text style={s.themeDescription}>{member.description}</Text>
                    )}
                  </View>
                ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function NetworkContent({
  graphModel,
  template,
}: {
  graphModel: ReportGraphModel;
  template: ReportTemplate;
}) {
  const groupsToShow =
    template === "executive"
      ? graphModel.connectionsByType
          .map((g) => ({ ...g, connections: g.connections.slice(0, 2) }))
          .filter((g) => g.connections.length > 0)
          .slice(0, 2)
      : graphModel.connectionsByType;

  const nodesToShow =
    template === "executive" ? graphModel.topNodes.slice(0, 4) : graphModel.nodes;

  return (
    <View>
      <Text style={s.sectionHeading}>Evidence Network</Text>
      <View style={s.dividerAccent} />

      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={s.statLabel}>Nodes</Text>
          <Text style={s.statValue}>{graphModel.nodeCount}</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statLabel}>Connections</Text>
          <Text style={s.statValue}>{graphModel.connectionCount}</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statLabel}>Groups</Text>
          <Text style={s.statValue}>{graphModel.acceptedThemeCount}</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statLabel}>Source Themes</Text>
          <Text style={s.statValue}>{graphModel.supportingThemeCount}</Text>
        </View>
      </View>

      {groupsToShow.length > 0 && (
        <>
          <Text style={s.sectionSubheading}>
            Connections ({graphModel.connectionCount})
          </Text>
          {groupsToShow.map((group) => (
            <View key={group.type} style={s.connectionGroupCard}>
              <View style={s.connectionGroupHeader}>
                <Text
                  style={[
                    s.connectionGroupTitle,
                    {
                      color:
                        (connectionPalette[group.type] ?? connectionPalette.related_to)
                          .accent,
                    },
                  ]}
                >
                  {group.label}
                </Text>
                <View style={s.connectionGroupCountBox}>
                  <Text style={s.connectionGroupCountText}>
                    {group.connections.length} item
                    {group.connections.length === 1 ? "" : "s"}
                  </Text>
                </View>
              </View>

              {group.connections.map((conn) => (
                <PdfConnectionCard
                  key={conn.key}
                  connection={conn}
                  groupLabel={formatConnectionTypeLabel(conn.connectionType)}
                />
              ))}
            </View>
          ))}
        </>
      )}

      {nodesToShow.length > 0 && (
        <>
          <Text style={s.sectionSubheading}>
            Nodes ({graphModel.nodeCount})
          </Text>
          {nodesToShow.map((node) => (
            <View
              key={node.key}
              style={
                node.nodeType === "insight"
                  ? [s.themeCard, s.themeCardMuted]
                  : [s.themeCard]
              }
              wrap={false}
            >
              <View style={s.themeLabelRow}>
                <Text style={s.themeLabel}>{node.label}</Text>
                <Text
                  style={
                    node.nodeType === "insight"
                      ? [s.themeBadge, s.themeBadgeMuted]
                      : [s.themeBadge]
                  }
                >
                  {node.nodeType}
                </Text>
                {node.consultationTitle && (
                  <Text style={[s.themeBadge, s.themeBadgeMuted]}>
                    {"\u2014"} {node.consultationTitle}
                  </Text>
                )}
              </View>
              {node.description && (
                <Text style={s.themeDescription}>{node.description}</Text>
              )}
              <Text style={s.themeDescription}>
                Degree {node.degree}
                {node.memberCount !== null ? `  ·  ${node.memberCount} members` : ""}
                {node.isUserAdded ? "  ·  User added" : ""}
              </Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function EvidenceContent({ report }: { report: ReportArtifactDetail }) {
  const consultationCount =
    report.consultations.length || report.consultationTitles.length;

  const rows =
    report.consultations.length > 0
      ? report.consultations.map((c, i) => ({
          i,
          title: c.title,
          date: c.date,
          people: c.people,
        }))
      : report.consultationTitles.map((title, i) => ({
          i,
          title,
          date: "",
          people: [] as string[],
        }));

  return (
    <View>
      <Text style={s.sectionHeading}>
        Source Evidence ({consultationCount})
      </Text>
      <View style={s.dividerAccent} />
      {rows.map(({ i, title, date, people }) => (
        <View key={i} style={s.evidenceCard} wrap={false}>
          <View style={s.evidenceNumberBox}>
            <Text style={s.evidenceNumberText}>{i + 1}</Text>
          </View>
          <View style={s.evidenceCardBody}>
            <Text style={s.evidenceTitle}>{title}</Text>
            {(date || people.length > 0) && (
              <View style={s.metaStack}>
                {date ? (
                  <PdfMetaLine label="Date" value={formatPdfMediumDate(date)} />
                ) : null}
                {people.length > 0 ? (
                  <PdfMetaLine label="People" value={people.join(", ")} />
                ) : null}
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

function formatMilestoneDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function AuditTrailContent({ report }: { report: ReportArtifactDetail }) {
  const trail = buildComplianceAuditTrail({
    consultations: report.consultations,
    auditSummary: report.auditSummary,
  });
  const hasSessions = trail.sessions.length > 0;
  const hasMilestones = trail.milestones.length > 0;

  if (!hasSessions && !hasMilestones) return null;

  return (
    <View>
      <Text style={s.sectionHeading}>Audit Trail</Text>
      <View style={s.dividerAccent} />

      {/* Tier 1: consultation sessions */}
      {hasSessions && (
        <View style={{ marginBottom: 10 }}>
          <View style={s.railDayRow}>
            <Text style={s.railDayLabel}>Consultation sessions</Text>
            <View style={s.railDayLine} />
          </View>
          {trail.sessions.map((c, i) => (
            <View key={i} style={s.railEventRow} wrap={false}>
              <View style={s.railDot} />
              <View style={s.railEventBody}>
                <Text style={s.railEventText}>{c.title}</Text>
                {c.date ? (
                  <Text style={s.railEntityText}>
                    {new Date(c.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Tier 2: process milestones */}
      {hasMilestones && (
        <View>
          <View style={s.railDayRow}>
            <Text style={s.railDayLabel}>Process record</Text>
            <View style={s.railDayLine} />
          </View>
          {trail.milestones.map((m, i) => (
            <View key={i} style={s.railEventRow} wrap={false}>
              <View style={s.railDot} />
              <View style={s.railEventBody}>
                <Text style={s.railEventText}>{m.label}</Text>
                <Text style={s.railEntityText}>{formatMilestoneDate(m.createdAt)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── buildSectionElements ─────────────────────────────────────────────────────
// Returns ordered section specs for both pass-1 counting and the final layout.

export function buildSectionElements(
  report: ReportArtifactDetail,
  template: ReportTemplate
): SectionElement[] {
  const sections: SectionElement[] = [];
  const graphModel = buildReportGraphModel(report.inputSnapshot);

  sections.push({
    id: "executiveSummary",
    label: "Executive Summary",
    element: <ExecutiveSummaryContent content={report.content} />,
  });

  sections.push({
    id: "keyThemes",
    label: "Key Themes",
    element: <KeyThemesContent report={report} template={template} />,
  });

  if (template === "standard") {
    const allGroups = getAllThemeGroups(report.inputSnapshot);
    const hasRejected = allGroups.some((g) => g.status === "management_rejected");

    if (hasRejected) {
      sections.push({
        id: "rejectedThemes",
        label: "Rejected Themes",
        element: <RejectedThemesContent report={report} />,
      });
    }

    if (graphModel) {
      sections.push({
        id: "network",
        label: "Evidence Network",
        element: <NetworkContent graphModel={graphModel} template={template} />,
      });
    }

    sections.push({
      id: "evidence",
      label: "Source Evidence",
      element: <EvidenceContent report={report} />,
    });

    const auditTrail = buildComplianceAuditTrail({
      consultations: report.consultations,
      auditSummary: report.auditSummary,
    });

    if (hasComplianceAuditTrailContent(auditTrail)) {
      sections.push({
        id: "auditTrail",
        label: "Audit Trail",
        element: <AuditTrailContent report={report} />,
      });
    }
  }

  return sections;
}

// ─── Main document ────────────────────────────────────────────────────────────

export function ReportPrintLayout({
  report,
  template,
  tocPageNumbers,
}: ReportPrintLayoutProps) {
  const generatedDate = formatPdfDate(report.generatedAt);
  const typeLabel = artifactTypeLabels[report.artifactType] ?? report.artifactType;
  const sections = buildSectionElements(report, template);

  return (
    <Document
      title={report.title ?? "Report"}
      author="ConsultantPlatform"
      subject={typeLabel}
    >
      {/* Page 1: Title page (no header/footer) */}
      <TitlePage report={report} />

      {/* Page 2: Table of contents */}
      <TocPage
        roundLabel={report.roundLabel}
        generatedDate={generatedDate}
        tocPageNumbers={tocPageNumbers}
        sections={sections}
      />

      {/* Pages 3+: Content sections, each on its own Page */}
      {sections.map(({ id, element }) => (
        <Page key={id} size="LETTER" style={s.page} wrap>
          <RunningHeader
            roundLabel={report.roundLabel}
            generatedDate={generatedDate}
          />
          <RunningFooter />
          {element}
        </Page>
      ))}
    </Document>
  );
}

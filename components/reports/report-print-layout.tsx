import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { ReportArtifactDetail } from "@/lib/actions/reports";

// ─── Types ───────────────────────────────────────────────────────────────────

type ReportTemplate = "standard" | "executive";

interface ReportPrintLayoutProps {
  report: ReportArtifactDetail;
  template: ReportTemplate;
}

// ─── Fonts ───────────────────────────────────────────────────────────────────
// Using built-in PDF fonts (no CDN dependency):
// Helvetica / Helvetica-Bold for UI labels and headings
// Times-Roman / Times-Bold for body copy

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

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    lineHeight: 1.65,
    color: colors.dark,
    paddingTop: 60,
    paddingBottom: 70,
    paddingHorizontal: 56,
    backgroundColor: colors.white,
  },

  // Header (fixed on every page)
  header: {
    position: "absolute",
    top: 24,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    paddingBottom: 8,
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

  // Footer (fixed on every page)
  footer: {
    position: "absolute",
    bottom: 28,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  footerText: {
    fontFamily: "Helvetica",
    fontSize: 7,
    color: colors.faint,
  },
  confidential: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: colors.faint,
    textTransform: "uppercase",
    letterSpacing: 2,
  },

  // Title block
  titleBlock: {
    marginBottom: 24,
  },
  reportType: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: colors.emerald,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    color: colors.black,
    lineHeight: 1.25,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: colors.light,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10,
  },
  metaItem: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: colors.light,
  },

  // Divider
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    marginVertical: 16,
  },
  dividerThick: {
    borderBottomWidth: 1.5,
    borderBottomColor: colors.emerald,
    marginVertical: 20,
    width: 40,
  },

  // Stats row
  statsRow: {
    flexDirection: "row",
    gap: 12,
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

  // Section heading
  sectionHeading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    color: colors.black,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionSubheading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: colors.light,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
  },

  // Content blocks
  paragraph: {
    marginBottom: 8,
    textAlign: "justify",
  },
  h1: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    color: colors.black,
    marginTop: 16,
    marginBottom: 6,
  },
  h2: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    color: colors.dark,
    marginTop: 14,
    marginBottom: 5,
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
    marginBottom: 8,
    paddingLeft: 4,
  },
  bulletItem: {
    flexDirection: "row",
    marginBottom: 3,
  },
  bulletDot: {
    width: 12,
    fontSize: 10,
    color: colors.emerald,
  },
  bulletText: {
    flex: 1,
  },

  // Theme cards
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
  themeCardSupporting: {
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
  themeBadgeSupporting: {
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

  // Evidence cards
  evidenceCard: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 3,
    padding: 10,
    marginBottom: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  evidenceNumber: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: colors.light,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.borderLight,
    textAlign: "center",
    lineHeight: 18,
  },
  evidenceTitle: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: colors.dark,
    flex: 1,
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const artifactTypeLabels: Record<string, string> = {
  summary: "Round Summary",
  report: "Board-Pack Report",
  email: "Evidence Email",
};

function formatPdfDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function estimateReadTime(content: string): number {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

// ─── Content renderer (for markdown-style text) ──────────────────────────────

function PdfContentBlocks({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/);

  return (
    <>
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith("### ")) {
          return (
            <Text key={i} style={s.h3}>
              {trimmed.slice(4)}
            </Text>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <Text key={i} style={s.h2}>
              {trimmed.slice(3)}
            </Text>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <Text key={i} style={s.h1}>
              {trimmed.slice(2)}
            </Text>
          );
        }

        const lines = trimmed.split("\n");
        const isBulletList = lines.every(
          (line) =>
            line.trim().startsWith("- ") ||
            line.trim().startsWith("\u2022 ") ||
            line.trim().startsWith("* ") ||
            line.trim() === ""
        );

        if (isBulletList) {
          return (
            <View key={i} style={s.bulletList}>
              {lines
                .filter((line) => line.trim())
                .map((line, j) => (
                  <View key={j} style={s.bulletItem}>
                    <Text style={s.bulletDot}>{"\u2022"}</Text>
                    <Text style={s.bulletText}>
                      {line.replace(/^[\s]*[-\u2022*]\s*/, "")}
                    </Text>
                  </View>
                ))}
            </View>
          );
        }

        return (
          <Text key={i} style={s.paragraph}>
            {trimmed}
          </Text>
        );
      })}
    </>
  );
}

// ─── Document component ──────────────────────────────────────────────────────

export function ReportPrintLayout({
  report,
  template,
}: ReportPrintLayoutProps) {
  const readTime = estimateReadTime(report.content);
  const typeLabel =
    artifactTypeLabels[report.artifactType] ?? report.artifactType;
  const generatedDate = formatPdfDate(report.generatedAt);

  const inputThemes = report.inputSnapshot.accepted_round_themes as
    | Array<{ label: string; description?: string | null }>
    | undefined;
  const supportingThemes =
    report.inputSnapshot.supporting_consultation_themes as
      | Array<{
          label: string;
          description?: string | null;
          consultation_title?: string | null;
        }>
      | undefined;

  const acceptedToShow =
    template === "executive" ? inputThemes?.slice(0, 3) : inputThemes;
  const showSupporting = template === "standard";
  const showEvidence = template === "standard";

  return (
    <Document
      title={report.title ?? "Report"}
      author="ConsultantPlatform"
      subject={typeLabel}
    >
      <Page size="LETTER" style={s.page} wrap>
        {/* Fixed header */}
        <View style={s.header} fixed>
          <Text style={s.headerLeft}>{typeLabel}</Text>
          <Text style={s.headerRight}>{report.roundLabel}</Text>
        </View>

        {/* Fixed footer with page numbers */}
        <View style={s.footer} fixed>
          <Text style={s.confidential}>Confidential</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
          <Text style={s.footerText}>{generatedDate}</Text>
        </View>

        {/* ─── Title block ─── */}
        <View style={s.titleBlock}>
          <Text style={s.reportType}>{typeLabel}</Text>
          <Text style={s.title}>{report.title ?? "Untitled Report"}</Text>
          <Text style={s.subtitle}>
            {report.roundLabel}
            {report.roundDescription ? ` \u2014 ${report.roundDescription}` : ""}
          </Text>
          <View style={s.metaRow}>
            <Text style={s.metaItem}>Generated {generatedDate}</Text>
            <Text style={s.metaItem}>~{readTime} min read</Text>
            {report.totalVersions > 1 && (
              <Text style={s.metaItem}>
                Version {report.versionNumber} of {report.totalVersions}
              </Text>
            )}
          </View>
        </View>

        {/* ─── Quick Stats ─── */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statLabel}>Consultations</Text>
            <Text style={s.statValue}>
              {report.consultationTitles.length}
            </Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statLabel}>Accepted Themes</Text>
            <Text style={s.statValue}>{report.acceptedThemeCount}</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statLabel}>Supporting Themes</Text>
            <Text style={s.statValue}>{report.supportingThemeCount}</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statLabel}>Reading Time</Text>
            <Text style={s.statValue}>~{readTime}m</Text>
          </View>
        </View>

        <View style={s.dividerThick} />

        {/* ─── Report content ─── */}
        <PdfContentBlocks content={report.content} />

        {/* ─── Key Findings ─── */}
        {acceptedToShow && acceptedToShow.length > 0 && (
          <View wrap={false}>
            <View style={s.divider} />
            <Text style={s.sectionHeading}>
              Key Findings
              {template === "executive" &&
                inputThemes &&
                inputThemes.length > 3 &&
                ` (Top 3 of ${inputThemes.length})`}
            </Text>
          </View>
        )}
        {acceptedToShow?.map((theme, i) => (
          <View key={i} style={s.themeCard} wrap={false}>
            <View style={s.themeLabelRow}>
              <Text style={s.themeLabel}>{theme.label}</Text>
              <Text style={s.themeBadge}>Accepted</Text>
            </View>
            {theme.description && (
              <Text style={s.themeDescription}>{theme.description}</Text>
            )}
          </View>
        ))}

        {/* ─── Supporting Themes ─── */}
        {showSupporting &&
          supportingThemes &&
          supportingThemes.length > 0 && (
            <>
              <View wrap={false} style={{ marginTop: 12 }}>
                <Text style={s.sectionSubheading}>
                  Supporting Themes ({supportingThemes.length})
                </Text>
              </View>
              {supportingThemes.map((theme, i) => (
                <View
                  key={i}
                  style={[s.themeCard, s.themeCardSupporting]}
                  wrap={false}
                >
                  <View style={s.themeLabelRow}>
                    <Text style={s.themeLabel}>{theme.label}</Text>
                    <Text style={[s.themeBadge, s.themeBadgeSupporting]}>
                      Supporting
                    </Text>
                    {theme.consultation_title && (
                      <Text
                        style={[
                          s.themeBadge,
                          s.themeBadgeSupporting,
                          { marginLeft: 4 },
                        ]}
                      >
                        {"\u2014"} {theme.consultation_title}
                      </Text>
                    )}
                  </View>
                  {theme.description && (
                    <Text style={s.themeDescription}>{theme.description}</Text>
                  )}
                </View>
              ))}
            </>
          )}

        {/* ─── Source Evidence ─── */}
        {showEvidence && report.consultationTitles.length > 0 && (
          <>
            <View wrap={false} style={{ marginTop: 12 }}>
              <View style={s.divider} />
              <Text style={s.sectionHeading}>
                Source Consultations ({report.consultationTitles.length})
              </Text>
            </View>
            {report.consultationTitles.map((title, i) => (
              <View key={i} style={s.evidenceCard} wrap={false}>
                <Text style={s.evidenceNumber}>{i + 1}</Text>
                <Text style={s.evidenceTitle}>{title}</Text>
              </View>
            ))}
          </>
        )}
      </Page>
    </Document>
  );
}

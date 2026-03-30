import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { ReportArtifactDetail } from "@/lib/actions/reports";
import {
  buildReportGraphModel,
  formatConnectionTypeLabel,
  getAllThemeGroups,
  type ReportGraphModel,
  type AllThemeGroupSnapshot,
} from "@/lib/report-graph";
import { parseContentBlocks } from "@/lib/report-content-blocks";

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
  numberedItem: {
    flexDirection: "row",
    marginBottom: 3,
  },
  numberedIndex: {
    fontFamily: "Helvetica-Bold",
    width: 16,
    fontSize: 10,
    color: colors.mid,
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
  summary: "Consultation Summary",
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

// ─── PDF inline renderer (supports **bold**) ─────────────────────────────────
//
// Returns the children for a <Text> node. Call sites are responsible for
// wrapping in <Text style={...}> so the base style is correctly typed.

function renderPdfInlineContent(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      // Bold segment: inherit parent style but switch to the bold font
      return (
        <Text key={i} style={{ fontFamily: "Helvetica-Bold" }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return part;
  });
}

// ─── Content renderer (for markdown-style text) ──────────────────────────────

function PdfContentBlocks({ content }: { content: string }) {
  const blocks = parseContentBlocks(content);

  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading1":
            return (
              <Text key={i} style={s.h1}>
                {block.text}
              </Text>
            );
          case "heading2":
            return (
              <Text key={i} style={s.h2}>
                {block.text}
              </Text>
            );
          case "heading3":
            return (
              <Text key={i} style={s.h3}>
                {block.text}
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
          case "prose":
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

function PdfGraphOverview({ graphModel }: { graphModel: ReportGraphModel }) {
  return (
    <>
      <View wrap={false}>
        <View style={s.divider} />
        <Text style={s.sectionHeading}>Evidence Network</Text>
        <Text style={s.sectionSubheading}>
          Snapshot saved {formatPdfDate(graphModel.snapshot.snapshotAt)}
        </Text>
      </View>
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
    </>
  );
}

function PdfGraphConnections({
  graphModel,
  template,
}: {
  graphModel: ReportGraphModel;
  template: ReportTemplate;
}) {
  const groupsToShow =
    template === "executive"
      ? graphModel.connectionsByType
          .map((group) => ({
            ...group,
            connections: group.connections.slice(0, 2),
          }))
          .filter((group) => group.connections.length > 0)
          .slice(0, 2)
      : graphModel.connectionsByType;

  return (
    <>
      <View wrap={false}>
        <Text style={s.sectionHeading}>
          Network Connections ({graphModel.connectionCount})
        </Text>
      </View>
      {groupsToShow.length === 0 ? (
        <View style={s.evidenceCard} wrap={false}>
          <Text style={s.themeDescription}>
            No saved typed connections were available on this artifact. The saved network still
            preserves nodes for future graph-aware report generations.
          </Text>
        </View>
      ) : (
        groupsToShow.map((group) => (
          <View key={group.type}>
            <Text style={s.sectionSubheading}>
              {group.label} ({group.connections.length})
            </Text>
            {group.connections.map((connection) => (
              <View key={connection.key} style={s.evidenceCard} wrap={false}>
                <View style={{ flex: 1 }}>
                  <Text style={s.evidenceTitle}>
                    {connection.fromLabel}
                    {" \u2192 "}
                    {formatConnectionTypeLabel(connection.connectionType)}
                    {" \u2192 "}
                    {connection.toLabel}
                  </Text>
                  <Text style={s.themeDescription}>
                    {connection.origin === "ai_suggested" ? "AI accepted" : "Manual"}
                    {connection.notes ? `  ·  ${connection.notes}` : ""}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))
      )}
    </>
  );
}

function PdfGraphNodes({
  graphModel,
  template,
}: {
  graphModel: ReportGraphModel;
  template: ReportTemplate;
}) {
  const nodesToShow =
    template === "executive"
      ? graphModel.topNodes.slice(0, 4)
      : graphModel.nodes;

  if (nodesToShow.length === 0) {
    return null;
  }

  return (
    <>
      <View wrap={false}>
        <Text style={s.sectionHeading}>Network Nodes ({graphModel.nodeCount})</Text>
      </View>
      {nodesToShow.map((node) => {
        const cardStyle =
          node.nodeType === "insight"
            ? [s.themeCard, s.themeCardSupporting]
            : [s.themeCard];
        const badgeStyle =
          node.nodeType === "insight"
            ? [s.themeBadge, s.themeBadgeSupporting]
            : [s.themeBadge];

        return (
          <View
            key={node.key}
            style={cardStyle}
            wrap={false}
          >
            <View style={s.themeLabelRow}>
              <Text style={s.themeLabel}>{node.label}</Text>
              <Text style={badgeStyle}>
                {node.nodeType}
              </Text>
              {node.consultationTitle && (
                <Text style={[s.themeBadge, s.themeBadgeSupporting]}>
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
        );
      })}
    </>
  );
}

// ─── Document component ──────────────────────────────────────────────────────

function PdfThemeHierarchy({
  report,
  template,
}: {
  report: ReportPrintLayoutProps["report"];
  template: ReportTemplate;
}) {
  const allGroups = getAllThemeGroups(report.inputSnapshot);
  const accepted = allGroups.filter((g) => g.status === "accepted");
  const pending = allGroups.filter((g) => g.status === "draft");
  const rejected = allGroups.filter((g) => g.status === "management_rejected");

  const acceptedToShow = template === "executive" ? accepted.slice(0, 3) : accepted;
  const showNonAccepted = template !== "executive";

  if (allGroups.length === 0) return null;

  return (
    <>
      {/* ─── Key Findings ─── */}
      {acceptedToShow.length > 0 && (
        <View wrap={false}>
          <View style={s.divider} />
          <Text style={s.sectionHeading}>
            Key Findings
            {template === "executive" &&
              accepted.length > 3 &&
              ` (Top 3 of ${accepted.length})`}
          </Text>
        </View>
      )}
      {acceptedToShow.map((group, i) => (
        <View key={i} wrap={false}>
          <View style={s.themeCard}>
            <View style={s.themeLabelRow}>
              <Text style={s.themeLabel}>{group.label}</Text>
              <Text style={s.themeBadge}>Accepted</Text>
            </View>
            {group.description && (
              <Text style={s.themeDescription}>{group.description}</Text>
            )}
          </View>
          {/* Child insights */}
          {group.members.length > 0 && (
            <View style={{ marginLeft: 12, marginTop: 2 }}>
              {[...group.members]
                .sort((a, b) => a.position - b.position)
                .map((member, j) => (
                  <View
                    key={j}
                    style={[s.themeCard, s.themeCardSupporting, { marginBottom: 3 }]}
                    wrap={false}
                  >
                    <View style={s.themeLabelRow}>
                      <Text style={s.themeLabel}>{member.label}</Text>
                      {member.sourceConsultationTitle ? (
                        <Text style={[s.themeBadge, s.themeBadgeSupporting]}>
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

      {/* ─── Pending themes ─── */}
      {showNonAccepted && pending.length > 0 && (
        <>
          <View wrap={false} style={{ marginTop: 12 }}>
            <Text style={s.sectionSubheading}>
              Pending Review ({pending.length})
            </Text>
          </View>
          {pending.map((group, i) => (
            <View key={i} style={s.themeCard} wrap={false}>
              <View style={s.themeLabelRow}>
                <Text style={s.themeLabel}>{group.label}</Text>
                <Text style={[s.themeBadge, s.themeBadgeSupporting]}>Pending</Text>
              </View>
              {group.description && (
                <Text style={s.themeDescription}>{group.description}</Text>
              )}
            </View>
          ))}
        </>
      )}

      {/* ─── Management-Rejected themes (standard/custom only) ─── */}
      {showNonAccepted && rejected.length > 0 && (
        <>
          <View wrap={false} style={{ marginTop: 12 }}>
            <View style={s.divider} />
            <Text style={s.sectionHeading}>
              Management-Rejected Themes ({rejected.length})
            </Text>
          </View>
          {rejected.map((group, i) => (
            <View key={i} style={[s.themeCard, s.themeCardSupporting]} wrap={false}>
              <View style={s.themeLabelRow}>
                <Text style={s.themeLabel}>{group.label}</Text>
                <Text style={[s.themeBadge, s.themeBadgeSupporting]}>Rejected</Text>
              </View>
              {group.description && (
                <Text style={s.themeDescription}>{group.description}</Text>
              )}
            </View>
          ))}
        </>
      )}
    </>
  );
}

export function ReportPrintLayout({
  report,
  template,
}: ReportPrintLayoutProps) {
  const readTime = estimateReadTime(report.content);
  const typeLabel =
    artifactTypeLabels[report.artifactType] ?? report.artifactType;
  const generatedDate = formatPdfDate(report.generatedAt);
  const graphModel = buildReportGraphModel(report.inputSnapshot);

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
            <Text style={s.statLabel}>Meetings</Text>
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

        {graphModel ? (
          <>
            <PdfGraphOverview graphModel={graphModel} />
            <PdfGraphConnections graphModel={graphModel} template={template} />
            <PdfGraphNodes graphModel={graphModel} template={template} />
            <View style={s.divider} />
            <PdfContentBlocks content={report.content} />
          </>
        ) : (
          <>
            {/* ─── Report content ─── */}
            <PdfContentBlocks content={report.content} />

            {/* ─── Theme hierarchy ─── */}
            <PdfThemeHierarchy report={report} template={template} />
          </>
        )}

        {/* ─── Source Evidence ─── */}
        {showEvidence && (report.consultations.length > 0 || report.consultationTitles.length > 0) && (
          <>
            <View wrap={false} style={{ marginTop: 12 }}>
              <View style={s.divider} />
              <Text style={s.sectionHeading}>
                Source Consultations ({report.consultations.length || report.consultationTitles.length})
              </Text>
            </View>
            {(report.consultations.length > 0
              ? report.consultations.map((c, i) => ({ i, title: c.title, date: c.date, people: c.people }))
              : report.consultationTitles.map((title, i) => ({ i, title, date: "", people: [] }))
            ).map(({ i, title, date, people }) => (
              <View key={i} style={s.evidenceCard} wrap={false}>
                <Text style={s.evidenceNumber}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.evidenceTitle}>{title}</Text>
                  {(date || people.length > 0) && (
                    <Text style={[s.themeDescription, { marginTop: 1 }]}>
                      {[
                        date ? new Date(date).toLocaleDateString("en-US", { dateStyle: "medium" }) : null,
                        people.length > 0 ? people.join(", ") : null,
                      ]
                        .filter(Boolean)
                        .join("  ·  ")}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </>
        )}

        {/* ─── Audit Trail (compliance page) ─── */}
        {report.auditSummary && report.auditSummary.length > 0 && (
          <>
            <View wrap={false} style={{ marginTop: 20 }}>
              <View style={s.divider} />
              <Text style={s.sectionHeading}>
                Audit Trail ({report.auditSummary.length} events)
              </Text>
            </View>
            {report.auditSummary.map((event, i) => (
              <View
                key={i}
                style={[s.evidenceCard, { flexDirection: "row", justifyContent: "space-between" }]}
                wrap={false}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.evidenceTitle}>
                    {event.action
                      .replace(/\./g, " \u2192 ")
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c: string) => c.toUpperCase())}
                  </Text>
                  {event.entityType && (
                    <Text style={s.themeDescription}>{event.entityType}</Text>
                  )}
                </View>
                <Text style={[s.themeDescription, { marginLeft: 8 }]}>
                  {new Date(event.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
                </Text>
              </View>
            ))}
          </>
        )}
      </Page>
    </Document>
  );
}

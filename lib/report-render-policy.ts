import type { GraphNetworkSnapshot, GraphSnapshotEdge, GraphSnapshotNode } from "@/lib/graph/types";
import type {
  AllThemeGroupSnapshot,
  ReportInputSnapshot,
  AcceptedConsultationThemeSnapshot,
  SupportingMeetingThemeSnapshot,
} from "@/lib/report-graph";
import type {
  StructuredReportDocument,
  StructuredReportOutline,
  StructuredReportOutlineSection,
  StructuredReportSection,
  StructuredReportSubsection,
} from "@/lib/report-document";
import { buildComplianceSessionLabel } from "@/lib/report-audit";
import type { ConsultationMeta, ReportArtifactDetail } from "@/types/report-artifact";

export interface ReportRenderPolicy {
  anonymousMode: boolean;
  maskText: (value: string) => string;
  maskPeople: (people: string[]) => string[];
  maskConsultationTitle: (title: string) => string;
}

interface ReplacementRule {
  pattern: RegExp;
  replacement: string;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function uniqueNormalized(values: string[]) {
  const seen = new Set<string>();

  return values.reduce<string[]>((acc, value) => {
    const trimmed = value.trim();
    const key = normalizeKey(trimmed);

    if (!trimmed || seen.has(key)) {
      return acc;
    }

    seen.add(key);
    acc.push(trimmed);
    return acc;
  }, []);
}

function stripParticipantCount(label: string) {
  return label.replace(/\s+\(\d+\s+(?:person|people)\)$/i, "");
}

function withOccurrenceSuffix(labels: string[]) {
  const totals = new Map<string, number>();
  const seen = new Map<string, number>();

  for (const label of labels) {
    totals.set(label, (totals.get(label) ?? 0) + 1);
  }

  return labels.map((label) => {
    if ((totals.get(label) ?? 0) === 1) {
      return label;
    }

    const nextIndex = (seen.get(label) ?? 0) + 1;
    seen.set(label, nextIndex);
    return `${label} (${nextIndex})`;
  });
}

function buildConsultationBaseLabel(consultation: ConsultationMeta, index: number) {
  const sessionLabel = stripParticipantCount(buildComplianceSessionLabel(consultation));

  if (sessionLabel && sessionLabel !== consultation.title) {
    return sessionLabel;
  }

  return `Meeting ${index + 1}`;
}

function buildReplacementRules(entries: Array<{ key: string; replacement: string }>) {
  return entries
    .filter(({ key, replacement }) => key.trim() && replacement.trim())
    .sort((left, right) => right.key.length - left.key.length)
    .map(({ key, replacement }) => ({
      pattern: new RegExp(
        `(?<![A-Za-z0-9_])${escapeRegExp(key)}(?![A-Za-z0-9_])`,
        "giu"
      ),
      replacement,
    })) satisfies ReplacementRule[];
}

function applyRules(value: string, rules: ReplacementRule[]) {
  return rules.reduce((result, rule) => result.replace(rule.pattern, rule.replacement), value);
}

function maskStructuredSubsection(
  subsection: StructuredReportSubsection,
  policy: ReportRenderPolicy
): StructuredReportSubsection {
  return {
    ...subsection,
    heading: policy.maskText(subsection.heading),
    paragraphs: subsection.paragraphs?.map(policy.maskText),
    bullet_points: subsection.bullet_points?.map(policy.maskText),
  };
}

function maskStructuredSection(
  section: StructuredReportSection,
  policy: ReportRenderPolicy
): StructuredReportSection {
  return {
    ...section,
    heading: policy.maskText(section.heading),
    paragraphs: section.paragraphs?.map(policy.maskText),
    bullet_points: section.bullet_points?.map(policy.maskText),
    subsections: section.subsections?.map((subsection) =>
      maskStructuredSubsection(subsection, policy)
    ),
  };
}

function maskStructuredOutlineSection(
  section: StructuredReportOutlineSection,
  policy: ReportRenderPolicy
): StructuredReportOutlineSection {
  return {
    ...section,
    heading: policy.maskText(section.heading),
    purpose: section.purpose ? policy.maskText(section.purpose) : section.purpose,
    prose_guidance: section.prose_guidance
      ? policy.maskText(section.prose_guidance)
      : section.prose_guidance,
    section_note: section.section_note
      ? policy.maskText(section.section_note)
      : section.section_note,
  };
}

function maskStructuredReportDocument(
  document: StructuredReportDocument | null | undefined,
  policy: ReportRenderPolicy
) {
  if (!document) {
    return document ?? null;
  }

  return {
    ...document,
    sections: document.sections?.map((section) => maskStructuredSection(section, policy)),
  } satisfies StructuredReportDocument;
}

function maskStructuredReportOutline(
  outline: StructuredReportOutline | null | undefined,
  policy: ReportRenderPolicy
) {
  if (!outline) {
    return outline ?? null;
  }

  return {
    ...outline,
    sections: outline.sections.map((section) => maskStructuredOutlineSection(section, policy)),
  } satisfies StructuredReportOutline;
}

function maskThemeSnapshot<T extends AcceptedConsultationThemeSnapshot | SupportingMeetingThemeSnapshot>(
  theme: T,
  policy: ReportRenderPolicy
): T {
  return {
    ...theme,
    label: policy.maskText(theme.label),
    description: theme.description ? policy.maskText(theme.description) : theme.description,
    consultation_title: theme.consultation_title
      ? policy.maskConsultationTitle(theme.consultation_title)
      : theme.consultation_title,
    grouped_under: theme.grouped_under
      ? policy.maskText(theme.grouped_under)
      : theme.grouped_under,
  };
}

function maskGraphNode(node: GraphSnapshotNode, policy: ReportRenderPolicy): GraphSnapshotNode {
  const meta = node.meta ?? {};

  return {
    ...node,
    label: policy.maskText(node.label),
    meta: {
      ...meta,
      description:
        typeof meta.description === "string" ? policy.maskText(meta.description) : meta.description,
      consultationTitle:
        typeof meta.consultationTitle === "string"
          ? policy.maskConsultationTitle(meta.consultationTitle)
          : meta.consultationTitle,
      groupLabel:
        typeof meta.groupLabel === "string" ? policy.maskText(meta.groupLabel) : meta.groupLabel,
    },
  };
}

function maskGraphEdge(edge: GraphSnapshotEdge, policy: ReportRenderPolicy): GraphSnapshotEdge {
  return {
    ...edge,
    notes: edge.notes ? policy.maskText(edge.notes) : edge.notes,
  };
}

function maskGraphSnapshot(
  snapshot: GraphNetworkSnapshot | null | undefined,
  policy: ReportRenderPolicy
) {
  if (!snapshot) {
    return snapshot ?? null;
  }

  return {
    ...snapshot,
    nodes: snapshot.nodes.map((node) => maskGraphNode(node, policy)),
    edges: snapshot.edges.map((edge) => maskGraphEdge(edge, policy)),
  } satisfies GraphNetworkSnapshot;
}

function maskThemeGroups(groups: AllThemeGroupSnapshot[], policy: ReportRenderPolicy) {
  return groups.map((group) => ({
    ...group,
    label: policy.maskText(group.label),
    description: group.description ? policy.maskText(group.description) : group.description,
    members: group.members.map((member) => ({
      ...member,
      label: policy.maskText(member.label),
      description: member.description ? policy.maskText(member.description) : member.description,
      sourceConsultationTitle: policy.maskConsultationTitle(member.sourceConsultationTitle),
    })),
  }));
}

function maskInputSnapshot(snapshot: ReportInputSnapshot, policy: ReportRenderPolicy): ReportInputSnapshot {
  return {
    ...snapshot,
    meetingTitles: snapshot.meetingTitles?.map(policy.maskConsultationTitle),
    consultations: snapshot.consultations?.map(policy.maskConsultationTitle),
    accepted_consultation_themes: snapshot.accepted_consultation_themes?.map((theme) =>
      maskThemeSnapshot(theme, policy)
    ),
    accepted_round_themes: snapshot.accepted_round_themes?.map((theme) =>
      maskThemeSnapshot(theme, policy)
    ),
    supporting_meeting_themes: snapshot.supporting_meeting_themes?.map((theme) =>
      maskThemeSnapshot(theme, policy)
    ),
    supporting_consultation_themes: snapshot.supporting_consultation_themes?.map((theme) =>
      maskThemeSnapshot(theme, policy)
    ),
    generated_report_document: maskStructuredReportDocument(
      snapshot.generated_report_document,
      policy
    ),
    report_template_outline: maskStructuredReportOutline(snapshot.report_template_outline, policy),
    all_theme_groups: snapshot.all_theme_groups
      ? maskThemeGroups(snapshot.all_theme_groups, policy)
      : snapshot.all_theme_groups,
    graphNetwork: maskGraphSnapshot(snapshot.graphNetwork, policy),
  };
}

export function createReportRenderPolicy(
  report: Pick<ReportArtifactDetail, "consultations" | "consultationTitles">,
  anonymousMode: boolean
): ReportRenderPolicy {
  if (!anonymousMode) {
    return {
      anonymousMode: false,
      maskText: (value) => value,
      maskPeople: (people) => people,
      maskConsultationTitle: (title) => title,
    };
  }

  const consultations = report.consultations ?? [];
  const consultationTitles =
    consultations.length > 0
      ? consultations.map((consultation) => consultation.title)
      : report.consultationTitles ?? [];

  const consultationLabels = consultations.length > 0
    ? withOccurrenceSuffix(
        consultations.map((consultation, index) => buildConsultationBaseLabel(consultation, index))
      )
    : consultationTitles.map((_, index) => `Meeting ${index + 1}`);

  const consultationReplacementEntries = consultationTitles.map((title, index) => ({
    key: title,
    replacement: consultationLabels[index] ?? `Meeting ${index + 1}`,
  }));
  const consultationReplacementMap = new Map(
    consultationReplacementEntries.map(({ key, replacement }) => [normalizeKey(key), replacement])
  );

  const uniquePeople = uniqueNormalized(
    consultations.flatMap((consultation) => consultation.people ?? [])
  );
  const personReplacementEntries = uniquePeople.map((person, index) => ({
    key: person,
    replacement: `Participant ${index + 1}`,
  }));
  const personReplacementMap = new Map(
    personReplacementEntries.map(({ key, replacement }) => [normalizeKey(key), replacement])
  );

  const firstNameBuckets = new Map<string, string[]>();
  for (const person of uniquePeople) {
    const firstName = person.split(/\s+/)[0]?.trim();
    if (!firstName) continue;

    const key = normalizeKey(firstName);
    const bucket = firstNameBuckets.get(key) ?? [];
    bucket.push(person);
    firstNameBuckets.set(key, bucket);
  }

  const firstNameEntries = Array.from(firstNameBuckets.entries())
    .filter(([, people]) => people.length === 1)
    .map(([firstName, [person]]) => ({
      key: person.split(/\s+/)[0] ?? person,
      replacement: personReplacementMap.get(normalizeKey(person)) ?? person,
    }));

  const rules = buildReplacementRules([
    ...consultationReplacementEntries,
    ...personReplacementEntries,
    ...firstNameEntries,
  ]);

  return {
    anonymousMode: true,
    maskText: (value: string) => applyRules(value, rules),
    maskPeople: (people: string[]) =>
      people.map((person) => personReplacementMap.get(normalizeKey(person)) ?? applyRules(person, rules)),
    maskConsultationTitle: (title: string) =>
      consultationReplacementMap.get(normalizeKey(title)) ?? applyRules(title, rules),
  };
}

export function applyRenderPolicyToReport(
  report: ReportArtifactDetail,
  anonymousMode: boolean
): ReportArtifactDetail {
  if (!anonymousMode) {
    return report;
  }

  const policy = createReportRenderPolicy(report, anonymousMode);

  return {
    ...report,
    title: report.title ? policy.maskText(report.title) : report.title,
    content: policy.maskText(report.content),
    roundDescription: report.roundDescription
      ? policy.maskText(report.roundDescription)
      : report.roundDescription,
    consultationTitles: report.consultationTitles.map(policy.maskConsultationTitle),
    consultations: report.consultations.map((consultation) => ({
      ...consultation,
      title: policy.maskConsultationTitle(consultation.title),
      people: policy.maskPeople(consultation.people),
    })),
    inputSnapshot: maskInputSnapshot(report.inputSnapshot, policy),
    draftThemeGroups: report.draftThemeGroups.map((group) => ({
      ...group,
      label: policy.maskText(group.label),
      description: group.description ? policy.maskText(group.description) : group.description,
    })),
  };
}
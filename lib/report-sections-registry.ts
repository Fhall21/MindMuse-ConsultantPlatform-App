import type {
  BuilderSectionConfig,
  CustomSectionDef,
  ReportTemplateSection,
} from "@/types/db";

export interface PredefinedSection {
  id: string;
  heading: string;
  description: string;
  defaultPurpose: string;
  defaultProseGuidance: string;
  defaultDepth: "brief" | "detailed";
  category: "core" | "evidence" | "analysis";
}

export const PREDEFINED_SECTIONS: PredefinedSection[] = [
  {
    id: "executive-summary",
    heading: "Executive Summary",
    description: "High-level overview of the consultation and key findings.",
    defaultPurpose:
      "Provide a concise summary of the consultation context, participants, and key outcomes.",
    defaultProseGuidance:
      "Write a clear, accessible summary that a senior stakeholder could read in isolation.",
    defaultDepth: "detailed",
    category: "core",
  },
  {
    id: "key-themes",
    heading: "Key Themes",
    description: "Primary themes identified during the consultation.",
    defaultPurpose:
      "Present the accepted themes with supporting evidence and context.",
    defaultProseGuidance:
      "Group themes logically. For each theme, provide a brief description and the evidence that supports it.",
    defaultDepth: "detailed",
    category: "core",
  },
  {
    id: "rejected-themes",
    heading: "Management-Rejected Themes",
    description: "Themes flagged by management as not relevant or out of scope.",
    defaultPurpose:
      "Document themes that were raised but rejected, with rationale where available.",
    defaultProseGuidance:
      "List each rejected theme briefly with the reason for rejection.",
    defaultDepth: "brief",
    category: "analysis",
  },
  {
    id: "network-diagram",
    heading: "Network Connections",
    description: "Relationships and connections between people and themes.",
    defaultPurpose:
      "Map the relational network showing who is connected to which themes and decisions.",
    defaultProseGuidance:
      "Describe the key connections. Reference the network diagram if included.",
    defaultDepth: "detailed",
    category: "analysis",
  },
  {
    id: "evidence",
    heading: "Evidence & Sources",
    description: "Supporting evidence referenced during the consultation.",
    defaultPurpose:
      "Provide a traceable list of evidence items linked to themes and decisions.",
    defaultProseGuidance:
      "Present evidence as a structured list with source attribution.",
    defaultDepth: "brief",
    category: "evidence",
  },
  {
    id: "audit-trail",
    heading: "Audit Trail",
    description: "Chronological record of decisions and status changes.",
    defaultPurpose:
      "Document the sequence of actions taken during the consultation for accountability.",
    defaultProseGuidance:
      "Use a chronological format. Include timestamps, actors, and decisions.",
    defaultDepth: "brief",
    category: "evidence",
  },
  {
    id: "recommendations",
    heading: "Recommendations",
    description: "Suggested next steps and follow-up actions.",
    defaultPurpose:
      "Provide actionable recommendations based on the consultation findings.",
    defaultProseGuidance:
      "Write specific, actionable recommendations. Prioritise by urgency or impact where appropriate.",
    defaultDepth: "detailed",
    category: "core",
  },
  {
    id: "risk-assessment",
    heading: "Risk Assessment",
    description: "Identified risks and their potential impact.",
    defaultPurpose:
      "Summarise risks surfaced during the consultation with severity and likelihood.",
    defaultProseGuidance:
      "Present risks clearly with mitigation suggestions where relevant.",
    defaultDepth: "detailed",
    category: "analysis",
  },
];

const sectionMap = new Map(
  PREDEFINED_SECTIONS.map((section) => [section.id, section])
);

export function getPredefinedSection(id: string): PredefinedSection | null {
  return sectionMap.get(id) ?? null;
}

export function getDefaultSections(): BuilderSectionConfig[] {
  const defaultIds = [
    "executive-summary",
    "key-themes",
    "recommendations",
    "evidence",
  ];

  return defaultIds.map((id, index) => {
    const section = sectionMap.get(id)!;
    return {
      sectionId: id,
      depth: section.defaultDepth,
      note: null,
      position: index,
    };
  });
}

export function sectionConfigToTemplateSection(
  config: BuilderSectionConfig,
  customSections: CustomSectionDef[]
): ReportTemplateSection {
  const predefined = sectionMap.get(config.sectionId);

  if (predefined) {
    return {
      heading: predefined.heading,
      purpose: predefined.defaultPurpose,
      prose_guidance: predefined.defaultProseGuidance,
      example_excerpt: null,
      depth: config.depth,
      section_note: config.note,
    };
  }

  // Custom section
  const custom = customSections.find((s) => s.id === config.sectionId);
  return {
    heading: custom?.heading ?? "Untitled Section",
    purpose: custom?.description ?? "",
    prose_guidance: "",
    example_excerpt: null,
    depth: config.depth,
    section_note: config.note,
  };
}

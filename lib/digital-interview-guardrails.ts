import { z } from "zod";
import type { DigitalInterviewFramework } from "@/lib/digital-interviews";

export type DigitalInterviewGuardrailSource = "universal" | "recommended" | "custom";

export interface DigitalInterviewGuardrail {
  id: string;
  source: DigitalInterviewGuardrailSource;
  label: string;
  description: string;
}

export interface DigitalInterviewGuardrailConfig {
  acceptedRecommendedIds: string[];
  dismissedRecommendedIds: string[];
  customGuardrails: string[];
}

export const digitalInterviewGuardrailConfigSchema = z
  .object({
    acceptedRecommendedIds: z.array(z.string().trim().min(1)).default([]),
    dismissedRecommendedIds: z.array(z.string().trim().min(1)).default([]),
    customGuardrails: z.array(z.string().trim().min(1).max(240)).max(8).default([]),
  })
  .default({
    acceptedRecommendedIds: [],
    dismissedRecommendedIds: [],
    customGuardrails: [],
  });

export const UNIVERSAL_DIGITAL_INTERVIEW_GUARDRAILS: DigitalInterviewGuardrail[] = [
  {
    id: "universal-no-legal-advice",
    source: "universal",
    label: "No legal or HR determinations",
    description:
      "The interviewer must not interpret law, policy obligations, or decide formal outcomes.",
  },
  {
    id: "universal-no-named-accusations",
    source: "universal",
    label: "No named accusations",
    description:
      "The interviewer redirects away from collecting names or allegations against identifiable people.",
  },
  {
    id: "universal-no-taking-sides",
    source: "universal",
    label: "No taking sides",
    description:
      "The interviewer stays neutral and asks about experience, impact, context, and support needs.",
  },
];

const RECOMMENDATION_LIBRARY: Array<
  DigitalInterviewGuardrail & {
    keywords: string[];
    frameworks?: DigitalInterviewFramework[];
  }
> = [
  {
    id: "recommended-avoid-medical-detail",
    source: "recommended",
    label: "Avoid private health detail",
    description:
      "Keep wellbeing topics focused on work experience and support needs, not diagnoses or treatment.",
    keywords: ["wellbeing", "health", "medical", "stress", "burnout", "trauma", "injury"],
  },
  {
    id: "recommended-avoid-identifying-complaints",
    source: "recommended",
    label: "De-identify complaint examples",
    description:
      "When conflict or grievances arise, ask for patterns and impact without names or identifying details.",
    keywords: ["complaint", "conflict", "bully", "harass", "grievance", "investigation"],
  },
  {
    id: "recommended-speak-up-safety",
    source: "recommended",
    label: "Protect speaking-up safety",
    description:
      "Avoid pressing for examples that could expose the participant or make retaliation concerns worse.",
    keywords: ["voice", "speak up", "psychological safety", "retaliation"],
    frameworks: ["psychological_safety"],
  },
  {
    id: "recommended-no-policy-interpretation",
    source: "recommended",
    label: "Do not interpret policy",
    description:
      "Ask about clarity, process, and lived experience without explaining or judging policy correctness.",
    keywords: ["policy", "legal", "compliance", "procedure"],
  },
  {
    id: "recommended-custom-boundary-check",
    source: "recommended",
    label: "Stay inside custom framework",
    description:
      "Use the custom framework as scope; do not expand into adjacent issues unless the participant raises them.",
    keywords: [],
    frameworks: ["custom"],
  },
];

export function normalizeGuardrailConfig(input: unknown): DigitalInterviewGuardrailConfig {
  return digitalInterviewGuardrailConfigSchema.parse(input ?? undefined);
}

export function recommendDigitalInterviewGuardrails(input: {
  title?: string | null;
  framework: DigitalInterviewFramework;
  customFrameworkPrompt?: string | null;
  topics: string[];
}) {
  const searchText = [
    input.title ?? "",
    input.framework,
    input.customFrameworkPrompt ?? "",
    ...input.topics,
  ]
    .join(" ")
    .toLowerCase();

  return RECOMMENDATION_LIBRARY.filter((guardrail) => {
    if (guardrail.frameworks?.includes(input.framework)) {
      return true;
    }
    return guardrail.keywords.some((keyword) => searchText.includes(keyword));
  });
}

export function getActiveDigitalInterviewGuardrails(input: {
  title?: string | null;
  framework: DigitalInterviewFramework;
  customFrameworkPrompt?: string | null;
  topics: string[];
  guardrailsConfig?: DigitalInterviewGuardrailConfig | null;
}) {
  const config = normalizeGuardrailConfig(input.guardrailsConfig);
  const recommended = recommendDigitalInterviewGuardrails(input).filter((guardrail) =>
    config.acceptedRecommendedIds.includes(guardrail.id)
  );
  const custom = config.customGuardrails.map((text, index) => ({
    id: `custom-${index + 1}`,
    source: "custom" as const,
    label: text,
    description: text,
  }));

  return {
    universal: UNIVERSAL_DIGITAL_INTERVIEW_GUARDRAILS,
    recommended,
    custom,
  };
}

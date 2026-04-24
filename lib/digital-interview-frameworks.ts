export type DigitalInterviewFrameworkCategory =
  | "individual_coaching_support"
  | "difficult_conversations_feedback"
  | "foundational_inquiry_lenses"
  | "incident_review"
  | "organizational_strategy_assessment"
  | "risk_assessment_system_analysis"
  | "group_facilitation";

export const DIGITAL_INTERVIEW_FRAMEWORK_CATEGORY_LABELS: Record<DigitalInterviewFrameworkCategory, string> = {
  individual_coaching_support: "Individual Coaching & Support",
  difficult_conversations_feedback: "Difficult Conversations & Feedback",
  foundational_inquiry_lenses: "Foundational & Inquiry Lenses",
  incident_review: "Incident Review",
  organizational_strategy_assessment: "Organizational Strategy & Assessment",
  risk_assessment_system_analysis: "Risk Assessment & System Analysis",
  group_facilitation: "Group Facilitation",
};

export const DIGITAL_INTERVIEW_FRAMEWORK_CATEGORY_ORDER: DigitalInterviewFrameworkCategory[] = [
  "individual_coaching_support",
  "difficult_conversations_feedback",
  "foundational_inquiry_lenses",
  "incident_review",
  "organizational_strategy_assessment",
  "risk_assessment_system_analysis",
  "group_facilitation",
];

export interface DigitalInterviewFrameworkDefinition {
  id: string;
  label: string;
  description: string;
  categories: readonly DigitalInterviewFrameworkCategory[];
  promptFile: string;
  defaultTopics: readonly string[];
}

export const DIGITAL_INTERVIEW_FRAMEWORKS = [
  {
    id: "care",
    label: "CARE",
    description: "Brief check-in framework for supportive, emotionally aware conversations.",
    categories: ["individual_coaching_support"],
    promptFile: "care.md",
    defaultTopics: ["Check in", "Listen actively", "Reassure", "Encourage help"],
  },
  {
    id: "alec",
    label: "ALEC",
    description: "Action-oriented support loop for listening, encouragement, and follow-up.",
    categories: ["individual_coaching_support"],
    promptFile: "alec.md",
    defaultTopics: ["Ask", "Listen", "Encourage action", "Check in"],
  },
  {
    id: "notice-open-listen-support",
    label: "Notice-Open-Listen-Support",
    description: "Empathic leadership sequence for opening a grounded support conversation.",
    categories: ["individual_coaching_support"],
    promptFile: "notice-open-listen-support.md",
    defaultTopics: ["Notice", "Open", "Listen", "Support"],
  },
  {
    id: "grow",
    label: "GROW",
    description: "Goal-setting and coaching structure for moving from intention to action.",
    categories: ["individual_coaching_support"],
    promptFile: "grow.md",
    defaultTopics: ["Goal", "Reality", "Options", "Will"],
  },
  {
    id: "clear",
    label: "CLEAR",
    description: "Coaching framework for clarifying the issue, exploring options, and reviewing action.",
    categories: ["individual_coaching_support"],
    promptFile: "clear.md",
    defaultTopics: ["Clarify", "Listen", "Explore", "Action", "Review"],
  },
  {
    id: "oscar",
    label: "OSCAR",
    description: "Structured conversation model for outcomes, situation, choices, and review.",
    categories: ["individual_coaching_support"],
    promptFile: "oscar.md",
    defaultTopics: ["Outcome", "Situation", "Choices", "Actions", "Review"],
  },
  {
    id: "motivational-interviewing",
    label: "Motivational Interviewing",
    description: "Conversation style for ambivalence, change talk, and commitment.",
    categories: ["individual_coaching_support"],
    promptFile: "motivational-interviewing.md",
    defaultTopics: ["Ambivalence", "Change talk", "Confidence", "Commitment"],
  },
  {
    id: "solution-focused-micro-frameworks",
    label: "Solution-Focused Micro-frameworks",
    description: "Short positive interventions that shift attention toward exceptions and next steps.",
    categories: ["individual_coaching_support"],
    promptFile: "solution-focused-micro-frameworks.md",
    defaultTopics: ["Preferred future", "Exceptions", "Scaling", "Next small step"],
  },
  {
    id: "stay",
    label: "STAY",
    description: "Grounded presence framework for difficult human moments.",
    categories: ["individual_coaching_support"],
    promptFile: "stay.md",
    defaultTopics: ["Stay present", "Talk gently", "Acknowledge pain", "Yield judgement"],
  },
  {
    id: "dear",
    label: "DEAR",
    description: "Feedback structure for describing the issue, expressing impact, and reinforcing change.",
    categories: ["difficult_conversations_feedback"],
    promptFile: "dear.md",
    defaultTopics: ["Describe", "Express", "Assert", "Reinforce"],
  },
  {
    id: "lead",
    label: "LEAD",
    description: "Conversation aid for listening, examples, awareness, and discovery.",
    categories: ["difficult_conversations_feedback"],
    promptFile: "lead.md",
    defaultTopics: ["Listen", "Example", "Awareness", "Discover"],
  },
  {
    id: "just-culture-approach",
    label: "Just Culture Approach",
    description: "Shared accountability lens for responding to mistakes, risk, and learning.",
    categories: ["difficult_conversations_feedback", "incident_review"],
    promptFile: "just-culture-approach.md",
    defaultTopics: ["Human error", "At-risk behaviour", "Reckless behaviour", "Learning response"],
  },
  {
    id: "restorative-workplace-practices",
    label: "Restorative Workplace Practices",
    description: "Repair-oriented conversation model for addressing harm and rebuilding trust.",
    categories: ["difficult_conversations_feedback", "incident_review", "group_facilitation"],
    promptFile: "restorative-workplace-practices.md",
    defaultTopics: ["Affected people", "Harm", "Accountability", "Repair", "Agreement"],
  },
  {
    id: "appreciative_inquiry",
    label: "Appreciative Inquiry",
    description: "Strengths-based inquiry cycle for discovering bright spots and designing better systems.",
    categories: ["foundational_inquiry_lenses"],
    promptFile: "appreciative_inquiry.md",
    defaultTopics: ["Discover bright spots", "Dream future", "Design systems", "Destiny commitments"],
  },
  {
    id: "bridge",
    label: "BRIDGE",
    description: "Supportive inquiry lens for moving from understanding to action.",
    categories: ["foundational_inquiry_lenses", "individual_coaching_support"],
    promptFile: "bridge.md",
    defaultTopics: ["Build rapport", "Reflect current state", "Identify resources", "Guide next steps"],
  },
  {
    id: "trauma-informed-leadership-principles",
    label: "Trauma-Informed Leadership Principles",
    description: "Principles for conversations that protect safety, choice, and dignity.",
    categories: ["foundational_inquiry_lenses", "risk_assessment_system_analysis"],
    promptFile: "trauma-informed-leadership-principles.md",
    defaultTopics: ["Safety", "Choice", "Trust", "Collaboration", "Empowerment"],
  },
  {
    id: "hop-4ds",
    label: "HOP 4Ds",
    description: "Quick scan for dangerous, difficult, dumb, and different patterns.",
    categories: ["foundational_inquiry_lenses", "incident_review"],
    promptFile: "hop-4ds.md",
    defaultTopics: ["Dangerous", "Difficult", "Dumb", "Different"],
  },
  {
    id: "orid",
    label: "ORID",
    description: "Structured reflection from objective facts through to decisions.",
    categories: ["foundational_inquiry_lenses", "incident_review", "group_facilitation"],
    promptFile: "orid.md",
    defaultTopics: ["Objective facts", "Reflective reactions", "Interpretive meaning", "Decisional actions"],
  },
  {
    id: "what-so-what-now-what",
    label: "What? So What? Now What?",
    description: "Simple reflective sequence for making sense of events and deciding next steps.",
    categories: ["foundational_inquiry_lenses", "incident_review", "group_facilitation"],
    promptFile: "what-so-what-now-what.md",
    defaultTopics: ["What happened", "So what", "Now what"],
  },
  {
    id: "plus-delta",
    label: "Plus / Delta",
    description: "Start-stop-continue style reflection for identifying what to keep and what to change.",
    categories: ["foundational_inquiry_lenses", "incident_review", "group_facilitation"],
    promptFile: "plus-delta.md",
    defaultTopics: ["Start", "Stop", "Continue", "Improve"],
  },
  {
    id: "team-support-loops",
    label: "Team Support Loops",
    description: "Repeatable check-in pattern for surfacing signals and following through together.",
    categories: ["foundational_inquiry_lenses", "group_facilitation", "organizational_strategy_assessment"],
    promptFile: "team-support-loops.md",
    defaultTopics: ["Signals", "Support needs", "Follow-up", "Escalation"],
  },
  {
    id: "abc",
    label: "ABC",
    description: "Antecedent-behaviour-consequence lens for understanding what preceded and followed an event.",
    categories: ["foundational_inquiry_lenses", "incident_review", "risk_assessment_system_analysis"],
    promptFile: "abc.md",
    defaultTopics: ["Antecedent", "Behaviour", "Consequence"],
  },
  {
    id: "psychological_safety",
    label: "Psychological Safety",
    description: "Conversation ladder for speaking up, normalising mistakes, and building trust.",
    categories: ["foundational_inquiry_lenses", "group_facilitation", "organizational_strategy_assessment"],
    promptFile: "psychological_safety.md",
    defaultTopics: ["Leader vulnerability", "Safe challenge", "Mistake normalisation", "Feedback loops", "Trust"],
  },
  {
    id: "smart",
    label: "SMART",
    description: "Demand and wellbeing lens for keeping work stimulating, sustainable, and relational.",
    categories: ["foundational_inquiry_lenses", "risk_assessment_system_analysis"],
    promptFile: "smart.md",
    defaultTopics: ["Stimulating", "Mastery", "Agency", "Relational", "Tolerable"],
  },
  {
    id: "event-analysis",
    label: "Event Analysis",
    description: "Simple before-during-after-learning frame for analysing a specific event.",
    categories: ["incident_review"],
    promptFile: "event-analysis.md",
    defaultTopics: ["Before", "During", "After", "Learning"],
  },
] as const satisfies readonly DigitalInterviewFrameworkDefinition[];

export type DigitalInterviewFrameworkId = (typeof DIGITAL_INTERVIEW_FRAMEWORKS)[number]["id"];

export type DigitalInterviewFramework = DigitalInterviewFrameworkId | "custom";

export const DIGITAL_INTERVIEW_FRAMEWORK_LABELS = {
  ...Object.fromEntries(DIGITAL_INTERVIEW_FRAMEWORKS.map((framework) => [framework.id, framework.label])),
  custom: "Custom",
} as Record<DigitalInterviewFramework, string>;

export const DIGITAL_INTERVIEW_FRAMEWORK_IDS = DIGITAL_INTERVIEW_FRAMEWORKS.map(
  (framework) => framework.id
) as [DigitalInterviewFrameworkId, ...DigitalInterviewFrameworkId[]];

export const DIGITAL_INTERVIEW_FRAMEWORK_VALUES = [
  ...DIGITAL_INTERVIEW_FRAMEWORK_IDS,
  "custom",
] as [DigitalInterviewFramework, ...DigitalInterviewFramework[]];

export const DIGITAL_INTERVIEW_CUSTOM_FRAMEWORK = {
  id: "custom",
  label: "Custom",
  description: "Define a custom interview focus and guidance.",
  categories: [] as const,
  promptFile: null,
  defaultTopics: [] as const,
} as const;

export const DIGITAL_INTERVIEW_FRAMEWORK_OPTIONS = [
  ...DIGITAL_INTERVIEW_FRAMEWORKS,
  DIGITAL_INTERVIEW_CUSTOM_FRAMEWORK,
] as const;

export function getDigitalInterviewFrameworkById(framework: DigitalInterviewFramework) {
  if (framework === "custom") {
    return DIGITAL_INTERVIEW_CUSTOM_FRAMEWORK;
  }

  return DIGITAL_INTERVIEW_FRAMEWORKS.find((definition) => definition.id === framework);
}

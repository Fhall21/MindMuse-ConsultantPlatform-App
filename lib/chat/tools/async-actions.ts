import { z } from "zod";

export const generateResearchQuestionsSchema = z.object({
  consultation_id: z.string().uuid(),
  theme_ids: z.array(z.string().uuid()).optional(),
});

export const draftEvidenceEmailSchema = z.object({
  consultation_id: z.string().uuid(),
  meeting_ids: z.array(z.string().uuid()).optional(),
});

export const generateReportSchema = z.object({
  consultation_id: z.string().uuid(),
});

export const linkResearchToThemesSchema = z.object({
  research_id: z.string().uuid(),
  consultation_id: z.string().uuid(),
});

export const researchQuestionSchema = z.object({
  id: z.string().uuid(),
  question: z.string(),
  rationale: z.string(),
  linked_theme_id: z.string().uuid().optional(),
});

export type ResearchQuestion = z.infer<typeof researchQuestionSchema>;

export interface ResearchQuestionReviewOutput {
  consultation_id: string;
  questions: ResearchQuestion[];
  dismissed_question_ids: string[];
}

export interface EmailDraftReviewOutput {
  consultation_id: string;
  meeting_id: string;
  draft_id: string;
  subject: string;
  body: string;
  supporting_quotes: Array<{ id: string; text: string; speaker?: string | null }>;
  linked_themes: Array<{ id: string; label: string }>;
  edited_body?: string;
}

export interface ReportDraftReviewOutput {
  consultation_id: string;
  draft_id: string;
  title: string;
  body: string;
  generated_at: string;
}

export interface ResearchThemeLinkProposal {
  research_id: string;
  consultation_id: string;
  links: Array<{
    theme_group_id: string;
    theme_group_label: string;
    relevance_score: number;
  }>;
  confirmed_theme_group_ids: string[];
}

export function readResearchQuestionReviewOutput(
  output: unknown
): ResearchQuestionReviewOutput | null {
  if (!output || typeof output !== "object") return null;
  const record = output as Record<string, unknown>;
  if (typeof record.consultation_id !== "string" || !Array.isArray(record.questions)) {
    return null;
  }

  const questions: ResearchQuestion[] = [];
  for (const item of record.questions) {
    const parsed = researchQuestionSchema.safeParse(item);
    if (parsed.success) questions.push(parsed.data);
  }

  const dismissed = Array.isArray(record.dismissed_question_ids)
    ? record.dismissed_question_ids.filter((id): id is string => typeof id === "string")
    : [];

  return {
    consultation_id: record.consultation_id,
    questions,
    dismissed_question_ids: dismissed,
  };
}

export function readEmailDraftReviewOutput(output: unknown): EmailDraftReviewOutput | null {
  if (!output || typeof output !== "object") return null;
  const record = output as Record<string, unknown>;
  if (
    typeof record.consultation_id !== "string" ||
    typeof record.subject !== "string" ||
    typeof record.body !== "string"
  ) {
    return null;
  }

  return {
    consultation_id: record.consultation_id,
    meeting_id: typeof record.meeting_id === "string" ? record.meeting_id : "",
    draft_id: typeof record.draft_id === "string" ? record.draft_id : "",
    subject: record.subject,
    body: record.body,
    edited_body:
      typeof record.edited_body === "string" ? record.edited_body : undefined,
    supporting_quotes: Array.isArray(record.supporting_quotes)
      ? record.supporting_quotes.filter(
          (item): item is { id: string; text: string; speaker?: string | null } =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as { id?: unknown }).id === "string" &&
            typeof (item as { text?: unknown }).text === "string"
        )
      : [],
    linked_themes: Array.isArray(record.linked_themes)
      ? record.linked_themes.filter(
          (item): item is { id: string; label: string } =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as { id?: unknown }).id === "string" &&
            typeof (item as { label?: unknown }).label === "string"
        )
      : [],
  };
}

export function readReportDraftReviewOutput(output: unknown): ReportDraftReviewOutput | null {
  if (!output || typeof output !== "object") return null;
  const record = output as Record<string, unknown>;
  if (
    typeof record.consultation_id !== "string" ||
    typeof record.title !== "string" ||
    typeof record.body !== "string"
  ) {
    return null;
  }

  return {
    consultation_id: record.consultation_id,
    draft_id: typeof record.draft_id === "string" ? record.draft_id : "",
    title: record.title,
    body: record.body,
    generated_at:
      typeof record.generated_at === "string"
        ? record.generated_at
        : new Date().toISOString(),
  };
}

export function readResearchThemeLinkProposal(
  output: unknown
): ResearchThemeLinkProposal | null {
  if (!output || typeof output !== "object") return null;
  const record = output as Record<string, unknown>;
  if (typeof record.research_id !== "string" || typeof record.consultation_id !== "string") {
    return null;
  }

  const links = Array.isArray(record.links)
    ? record.links.filter(
        (item): item is ResearchThemeLinkProposal["links"][number] =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as { theme_group_id?: unknown }).theme_group_id === "string" &&
          typeof (item as { theme_group_label?: unknown }).theme_group_label === "string" &&
          typeof (item as { relevance_score?: unknown }).relevance_score === "number"
      )
    : [];

  const confirmed = Array.isArray(record.confirmed_theme_group_ids)
    ? record.confirmed_theme_group_ids.filter((id): id is string => typeof id === "string")
    : links.slice(0, 1).map((link) => link.theme_group_id);

  return {
    research_id: record.research_id,
    consultation_id: record.consultation_id,
    links,
    confirmed_theme_group_ids: confirmed,
  };
}

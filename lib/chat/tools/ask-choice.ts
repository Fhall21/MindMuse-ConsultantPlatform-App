import { z } from "zod";

/** Prefix for card-submitted replies — used in prompts and route follow-up detection. */
export const ASK_CHOICE_REPLY_PREFIX = "[User choice]";

export const askChoicePurposeSchema = z.enum(["explore", "confirm", "disambiguate"]);

export const askChoiceQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  mode: z.enum(["single", "multi"]),
  options: z.array(z.string()).min(2).max(8),
  purpose: askChoicePurposeSchema.optional(),
});

export const askUserChoiceSchema = z.object({
  /** Short label for why choices are shown (e.g. "Confirm next step", "Which meeting"). */
  context: z.string().trim().max(200).optional(),
  questions: z.array(askChoiceQuestionSchema).min(1).max(6),
});

export type AskChoiceQuestion = z.infer<typeof askChoiceQuestionSchema>;
export type AskChoicePurpose = z.infer<typeof askChoicePurposeSchema>;

export function readAskChoiceQuestions(output: unknown): AskChoiceQuestion[] | null {
  if (!output || typeof output !== "object") return null;
  const record = output as Record<string, unknown>;
  if (!Array.isArray(record.questions)) return null;
  const questions = record.questions.filter(
    (q): q is AskChoiceQuestion =>
      q !== null &&
      typeof q === "object" &&
      typeof (q as AskChoiceQuestion).id === "string" &&
      typeof (q as AskChoiceQuestion).question === "string" &&
      ["single", "multi"].includes((q as AskChoiceQuestion).mode) &&
      Array.isArray((q as AskChoiceQuestion).options)
  );
  return questions.length > 0 ? questions : null;
}

export function readAskChoiceContext(output: unknown): string | null {
  if (!output || typeof output !== "object") return null;
  const context = (output as Record<string, unknown>).context;
  return typeof context === "string" && context.trim() ? context.trim() : null;
}

export function isAskChoiceUserReply(text: string): boolean {
  return text.trimStart().startsWith(ASK_CHOICE_REPLY_PREFIX);
}

export function formatChoiceAnswers(
  questions: AskChoiceQuestion[],
  answers: Map<string, string[]>,
  context?: string | null
): string {
  const header = context?.trim()
    ? `${ASK_CHOICE_REPLY_PREFIX} ${context.trim()}`
    : ASK_CHOICE_REPLY_PREFIX;

  const lines = questions.map((q, i) => {
    const selected = answers.get(q.id) ?? [];
    return `${i + 1}. ${q.question}\n   → ${selected.length > 0 ? selected.join(", ") : "(no selection)"}`;
  });

  return `${header}\n${lines.join("\n")}`;
}

/** Card shell title from question purposes and count. */
export function askChoiceCardTitle(questions: AskChoiceQuestion[]): string {
  if (questions.length === 1) {
    const purpose = questions[0].purpose;
    if (purpose === "confirm") return "Confirm";
    if (purpose === "disambiguate") return "Which one?";
  }
  const allConfirm = questions.every(
    (q) => q.purpose === "confirm" || q.purpose === "disambiguate"
  );
  if (allConfirm) return "Quick confirmation";
  return "Clarification needed";
}

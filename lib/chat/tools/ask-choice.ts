import { z } from "zod";

export const askChoiceQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  mode: z.enum(["single", "multi"]),
  options: z.array(z.string()).min(2).max(8),
});

export const askUserChoiceSchema = z.object({
  questions: z.array(askChoiceQuestionSchema).min(1).max(6),
});

export type AskChoiceQuestion = z.infer<typeof askChoiceQuestionSchema>;

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

export function formatChoiceAnswers(
  questions: AskChoiceQuestion[],
  answers: Map<string, string[]>
): string {
  if (questions.length === 1) {
    const q = questions[0];
    return (answers.get(q.id) ?? []).join(", ");
  }
  return questions
    .map((q, i) => {
      const selected = answers.get(q.id) ?? [];
      return `${i + 1}. ${q.question}\n   → ${selected.join(", ")}`;
    })
    .join("\n");
}

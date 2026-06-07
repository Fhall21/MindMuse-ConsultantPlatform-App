import { z } from "zod";

export const gridGenerateResponseSchema = z.object({
  answers: z.array(
    z.object({
      columnId: z.string().min(1),
      cellId: z.string().min(1),
      insights: z.array(
        z.object({
          text: z.string().min(1),
          existingInsightId: z.string().min(1).nullable().optional(),
          quotes: z.array(
            z.object({
              exactText: z.string().min(1),
              spanStart: z.number().int().nonnegative(),
              spanEnd: z.number().int().nonnegative(),
              relevanceStrength: z.enum([
                "strong_match",
                "partial_support",
                "context",
                "weak",
              ]),
            })
          ),
        })
      ),
      confidence: z.enum(["high", "medium", "low"]).nullable(),
      hasEvidence: z.boolean(),
    })
  ),
});

export type GridGenerateResponse = z.infer<typeof gridGenerateResponseSchema>;

export const gridColumnSuggestionsResponseSchema = z.object({
  suggestions: z.array(z.string().trim().min(1)).max(5),
});

export type ConnectedColumnRow = {
  insightId: string;
  columnId: string;
  question: string;
  gridReviewState: "pending" | "accepted" | "rejected" | "edited" | null;
  accepted: boolean;
};

export type QuoteLinkRow = {
  insightId: string;
  id: string;
  exactText: string;
  speakerLabel: string | null;
  spanStart: number;
  spanEnd: number;
  relevanceStrength: "strong_match" | "partial_support" | "context" | "weak" | null;
};

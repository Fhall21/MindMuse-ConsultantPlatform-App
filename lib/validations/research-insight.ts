import { z } from "zod/v4";

const trimmedString = z.string().transform((s) => s.trim());

// Locator anchors the quote back to its source. All fields optional so the
// extractor can supply whichever locators are available (text offsets in the
// rendered answer, an explicit referenceId from the research result, a page
// number for paged sources).
export const quoteLocatorSchema = z
  .object({
    answerId: trimmedString.pipe(z.string().min(1).max(200)).optional(),
    referenceId: trimmedString.pipe(z.string().min(1).max(200)).optional(),
    startOffset: z.number().int().nonnegative().optional(),
    endOffset: z.number().int().nonnegative().optional(),
    page: z.number().int().positive().optional(),
    sourceUrl: z.string().url().max(2048).optional(),
  })
  .refine(
    (loc) => {
      // If both offsets supplied, end must be > start.
      if (loc.startOffset !== undefined && loc.endOffset !== undefined) {
        return loc.endOffset > loc.startOffset;
      }
      return true;
    },
    { message: "endOffset must be greater than startOffset" }
  )
  .refine(
    (loc) =>
      loc.answerId !== undefined ||
      loc.referenceId !== undefined ||
      loc.sourceUrl !== undefined ||
      loc.page !== undefined,
    {
      message: "locator must include at least one anchor (answerId, referenceId, sourceUrl, or page)",
    }
  );

export const extractResearchInsightSchema = z.object({
  consultationId: z.string().uuid(),
  researchSessionId: z.string().uuid(),
  quote: trimmedString.pipe(
    z.string().min(8, "quote must be at least 8 characters").max(4000)
  ),
  locator: quoteLocatorSchema,
  label: trimmedString.pipe(z.string().min(1).max(500)),
  description: trimmedString
    .pipe(z.string().max(4000))
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  positionX: z.number().finite().optional(),
  positionY: z.number().finite().optional(),
});

export type ExtractResearchInsightInput = z.infer<typeof extractResearchInsightSchema>;

export const placeResearchInsightSchema = z.object({
  consultationId: z.string().uuid(),
  insightId: z.string().uuid(),
  positionX: z.number().finite().optional(),
  positionY: z.number().finite().optional(),
});

export type PlaceResearchInsightInput = z.infer<typeof placeResearchInsightSchema>;

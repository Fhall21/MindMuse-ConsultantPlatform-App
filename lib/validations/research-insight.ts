import { z } from "zod/v4";

const trimmedString = z.string().transform((s) => s.trim());

// Locator captures whichever anchoring metadata is available — text offsets,
// an explicit referenceId from the research result, a page number, a URL.
// All fields optional; the empty object is a valid locator (the insight's
// research_session_id is the canonical anchor; this object only narrows it).
const analysisSourceKindSchema = z.enum([
  "answer",
  "artifact",
  "figure",
  "notebook_cell",
]);

export const quoteLocatorSchema = z
  .object({
    // Literature anchors
    answerId: trimmedString.pipe(z.string().min(1).max(200)).optional(),
    referenceId: trimmedString.pipe(z.string().min(1).max(200)).optional(),
    startOffset: z.number().int().nonnegative().optional(),
    endOffset: z.number().int().nonnegative().optional(),
    page: z.number().int().positive().optional(),
    sourceUrl: z.string().url().max(2048).optional(),
    // Analysis anchors (stored in the same JSONB locator column)
    sourceKind: analysisSourceKindSchema.optional(),
    artifactEntryId: trimmedString.pipe(z.string().min(1).max(200)).optional(),
    figureKey: trimmedString.pipe(z.string().min(1).max(200)).optional(),
    notebookCellIndex: z.number().int().nonnegative().optional(),
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
    (loc) => {
      if (loc.sourceKind === "artifact") return Boolean(loc.artifactEntryId);
      if (loc.sourceKind === "figure") return Boolean(loc.figureKey);
      if (loc.sourceKind === "notebook_cell") {
        return loc.notebookCellIndex !== undefined;
      }
      return true;
    },
    { message: "sourceKind requires its companion locator field" }
  );

export const extractResearchInsightSchema = z.object({
  consultationId: z.string().uuid(),
  researchSessionId: z.string().uuid(),
  quote: trimmedString.pipe(
    z.string().min(8, "quote must be at least 8 characters").max(4000)
  ),
  locator: quoteLocatorSchema.default({}),
  label: trimmedString.pipe(z.string().min(1, "label is required").max(500)),
  description: trimmedString.pipe(
    z
      .string()
      .min(5, "notes must be at least 5 characters")
      .max(4000)
  ),
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

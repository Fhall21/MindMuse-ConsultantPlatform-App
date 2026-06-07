import { computeInsightConfidence } from "@/lib/quotes/insight-confidence";
import { computeQuoteContext } from "@/lib/quotes/transcript-context";
import type { CellConfidence, InsightWithLinks, QuoteLink } from "@/types/grid";
import type { ConnectedColumnRow, QuoteLinkRow } from "@/app/api/client/consultations/[roundId]/grid/_types";

type JunctionRow = {
  id: string;
  label: string;
  description: string | null;
  junctionId: string;
  editedLabel: string | null;
  gridReviewState: InsightWithLinks["gridReviewState"] | null;
  accepted: boolean;
  rejected: boolean;
  gridCellId: string;
  gridColumnId: string;
  createdAt?: string | Date;
};

export function buildGridInsightsResponse(
  junctionRows: JunctionRow[],
  connectedCols: ConnectedColumnRow[],
  quotesList: QuoteLinkRow[],
  transcriptRaw: string | null
): InsightWithLinks[] {
  return junctionRows.map((row) => {
    const rowConnectedCols = connectedCols
      .filter((col) => col.insightId === row.id)
      .map((col) => ({
        columnId: col.columnId,
        question: col.question,
        gridReviewState: col.gridReviewState ?? "pending",
        accepted: col.accepted,
      }));

    const rowQuotes: QuoteLink[] = quotesList
      .filter((quote) => quote.insightId === row.id)
      .map((quote) => {
        const transcript = quote.transcriptRaw ?? transcriptRaw;
        const expanded =
          transcript && quote.spanStart >= 0 && quote.spanEnd > quote.spanStart
            ? computeQuoteContext(
                transcript,
                quote.spanStart,
                quote.spanEnd,
                "expanded"
              )
            : { contextBefore: null, contextAfter: null };

        return {
          id: quote.id,
          exactText: quote.exactText,
          speakerLabel: quote.speakerLabel,
          spanStart: quote.spanStart,
          spanEnd: quote.spanEnd,
          relevanceStrength: quote.relevanceStrength,
          contextBefore: quote.contextBefore,
          contextAfter: quote.contextAfter,
          expandedContextBefore: expanded.contextBefore,
          expandedContextAfter: expanded.contextAfter,
        };
      });

    const quoteConfidence: CellConfidence | null = computeInsightConfidence(
      rowQuotes.map((quote) => ({
        relevanceStrength: quote.relevanceStrength,
      }))
    );

    return {
      ...row,
      gridReviewState: row.gridReviewState ?? "pending",
      connectedColumns: rowConnectedCols,
      quotes: rowQuotes,
      quoteConfidence,
    };
  });
}

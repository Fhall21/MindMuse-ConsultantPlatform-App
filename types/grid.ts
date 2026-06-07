export type GridReviewState =
  | "pending"
  | "accepted"
  | "rejected"
  | "edited";

export type CellStatus =
  | "pending"
  | "generating"
  | "complete"
  | "no_evidence"
  | "failed";

export type RelevanceStrength =
  | "strong_match"
  | "partial_support"
  | "context"
  | "weak";

export interface GridColumn {
  id: string;
  consultationId: string;
  question: string;
  position: number;
}

export interface GridCell {
  id: string;
  meetingId: string;
  columnId: string;
  status: CellStatus;
  confidence: "high" | "medium" | "low" | null;
  insightCount: number;
  quoteCount: number;
}

export interface QuoteLink {
  id: string;
  exactText: string;
  speakerLabel: string | null;
  spanStart: number;
  spanEnd: number;
  relevanceStrength: RelevanceStrength | null;
}

export interface InsightWithLinks {
  id: string;
  label: string;
  description: string | null;
  junctionId: string;
  editedLabel: string | null;
  gridReviewState: GridReviewState;
  accepted: boolean;
  rejected: boolean;
  gridCellId: string;
  gridColumnId: string;
  connectedColumns: {
    columnId: string;
    question: string;
    gridReviewState: GridReviewState;
    accepted: boolean;
  }[];
  quotes: QuoteLink[];
}

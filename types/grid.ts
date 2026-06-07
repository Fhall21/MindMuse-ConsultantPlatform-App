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

export type CellConfidence = "high" | "medium" | "low";

export interface GridColumn {
  id: string;
  consultationId: string;
  question: string;
  position: number;
  createdAt: string;
}

export interface GridCell {
  id: string;
  meetingId: string;
  columnId: string;
  status: CellStatus;
  confidence: CellConfidence | null;
  insightCount: number;
  quoteCount: number;
  generatedAt: string | null;
}

export interface GridData {
  columns: GridColumn[];
  cells: GridCell[];
}

export interface MeetingGenerateResult {
  meetingId: string;
  cells: { cellId: string; status: CellStatus; insightCount: number }[];
}

export interface QuoteLink {
  id: string;
  exactText: string;
  speakerLabel: string | null;
  spanStart: number;
  spanEnd: number;
  relevanceStrength: RelevanceStrength | null;
  contextBefore: string | null;
  contextAfter: string | null;
  expandedContextBefore?: string | null;
  expandedContextAfter?: string | null;
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
  createdAt?: string;
  connectedColumns: {
    columnId: string;
    question: string;
    gridReviewState: GridReviewState;
    accepted: boolean;
  }[];
  quotes: QuoteLink[];
  quoteConfidence: CellConfidence | null;
}

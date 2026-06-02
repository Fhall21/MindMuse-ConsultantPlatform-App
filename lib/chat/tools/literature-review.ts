import { z } from "zod";

export const prepareLiteratureReviewSchema = z.object({
  query: z.string().trim().min(10),
  industry_ctx: z.string().trim().optional(),
});

export interface LiteratureReviewProposal {
  query: string;
  industry_ctx?: string | null;
  research_session_id?: string;
}

export function readLiteratureReviewProposal(
  value: unknown
): LiteratureReviewProposal | null {
  if (!value || typeof value !== "object") return null;
  const proposal = value as Record<string, unknown>;
  if (typeof proposal.query !== "string") return null;

  return {
    query: proposal.query,
    industry_ctx:
      typeof proposal.industry_ctx === "string" ? proposal.industry_ctx : null,
    research_session_id:
      typeof proposal.research_session_id === "string"
        ? proposal.research_session_id
        : undefined,
  };
}

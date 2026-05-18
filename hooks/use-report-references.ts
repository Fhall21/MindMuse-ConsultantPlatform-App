import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";

export interface ReportReferenceQuote {
  id: string;
  quote: string;
  locator: Record<string, unknown> | null;
}

export interface ReportReference {
  number: number;
  insightId: string;
  insightLabel: string;
  researchSessionId: string;
  researchSessionQuery: string;
  shortCite: string;
  fullCite: string;
  sourceUrl: string | null;
  quotes: ReportReferenceQuote[];
}

export interface ReportReferenceResponse {
  references: ReportReference[];
  insightLabels: Record<string, string>;
  insightNumbers: Record<string, number>;
}

export function useReportReferences(reportId: string | null) {
  return useQuery<ReportReferenceResponse>({
    queryKey: ["report-references", reportId] as const,
    queryFn: () => fetchJson<ReportReferenceResponse>(`/api/reports/${reportId}/references`),
    enabled: Boolean(reportId),
    staleTime: 30_000,
  });
}

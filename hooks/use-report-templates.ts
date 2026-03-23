import { useQuery } from "@tanstack/react-query";
import { listReportTemplates } from "@/lib/actions/report-templates";
import type { ReportTemplate } from "@/types/db";

export function useReportTemplates() {
  return useQuery<ReportTemplate[]>({
    queryKey: ["report-templates"],
    queryFn: () => listReportTemplates(),
  });
}

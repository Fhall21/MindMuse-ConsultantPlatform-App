import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";

export interface DashboardStats {
  totalConsultations: number;
  totalPeople: number;
  emailsSent: number;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard_stats"],
    queryFn: () => fetchJson<DashboardStats>("/api/client/dashboard/stats"),
  });
}

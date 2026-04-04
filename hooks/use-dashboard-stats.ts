import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";

export interface DashboardStats {
  userId: string;
  totalConsultations: number;
  totalPeople: number;
  emailsSent: number;
  // Onboarding checklist counts
  totalMeetings: number;
  totalInsights: number;
  totalAiInsights: number;
  totalThemes: number;
  totalCanvasConnections: number;
  totalReports: number;
  totalCustomTemplates: number;
  potentialTimeSavedMinutes: number;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard_stats"],
    queryFn: () => fetchJson<DashboardStats>("/api/client/dashboard/stats"),
    // Always refetch on mount and window focus so checklist reflects
    // completions made on other pages within the same session.
    staleTime: 0,
  });
}

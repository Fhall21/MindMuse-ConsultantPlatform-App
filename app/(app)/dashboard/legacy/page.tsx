import { redirect } from "next/navigation";
import LegacyDashboardPage from "@/components/dashboard/legacy-dashboard-page";
import { isLegacyDashboardEnabled } from "@/lib/chat/feature-flags";

export default function DashboardLegacyPage() {
  if (!isLegacyDashboardEnabled()) {
    redirect("/dashboard");
  }

  return <LegacyDashboardPage />;
}

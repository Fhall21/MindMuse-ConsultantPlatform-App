import { SharedReportPage } from "@/components/reports/shared-report-page";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <SharedReportPage token={token} />;
}
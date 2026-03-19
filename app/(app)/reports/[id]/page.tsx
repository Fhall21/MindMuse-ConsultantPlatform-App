"use client";

import { use } from "react";
import { ReportView } from "@/components/reports/report-view";

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ReportView artifactId={id} />;
}

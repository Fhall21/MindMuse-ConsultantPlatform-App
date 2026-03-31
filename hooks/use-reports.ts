import { useQuery } from "@tanstack/react-query";

import {
  getReportArtifacts,
  getReportArtifact,
  getReportArtifactVersions,
} from "@/lib/actions/reports";
import type {
  ReportArtifactDetail,
  ReportArtifactListItem,
} from "@/types/report-artifact";

export function useReportArtifacts() {
  return useQuery<ReportArtifactListItem[]>({
    queryKey: ["report_artifacts"],
    queryFn: () => getReportArtifacts(),
  });
}

export function useReportArtifact(artifactId: string) {
  return useQuery<ReportArtifactDetail | null>({
    queryKey: ["report_artifact", artifactId],
    queryFn: () => getReportArtifact(artifactId),
    enabled: Boolean(artifactId),
  });
}

export function useReportArtifactVersions(
  roundId: string,
  artifactType: string
) {
  return useQuery<ReportArtifactListItem[]>({
    queryKey: ["report_artifact_versions", roundId, artifactType],
    queryFn: () => getReportArtifactVersions(roundId, artifactType),
    enabled: Boolean(roundId) && Boolean(artifactType),
  });
}

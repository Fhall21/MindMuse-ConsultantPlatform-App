"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface BulkAcceptTarget {
  id: string;
  gridCellId: string;
}

export interface BulkAcceptResult {
  accepted: number;
  failed: string[];
}

export async function acceptInsightsSequentially(
  insights: BulkAcceptTarget[],
  onProgress?: (completed: number) => void
): Promise<BulkAcceptResult> {
  const failed: string[] = [];

  for (const [index, { id, gridCellId }] of insights.entries()) {
    try {
      const response = await fetch(`/api/client/insights/${id}/grid-review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cellId: gridCellId,
          gridReviewState: "accepted",
        }),
      });

      if (!response.ok) failed.push(id);
    } catch {
      failed.push(id);
    }

    onProgress?.(index + 1);
  }

  return {
    accepted: insights.length - failed.length,
    failed,
  };
}

export function useBulkAccept(roundId: string) {
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  const bulkAccept = async (insights: BulkAcceptTarget[]) => {
    setProgress({ current: 0, total: insights.length });

    const result = await acceptInsightsSequentially(insights, (current) => {
      setProgress({ current, total: insights.length });
    });

    setProgress(null);

    const cellIds = [...new Set(insights.map((insight) => insight.gridCellId))];
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["grid-insights", roundId] }),
      queryClient.invalidateQueries({ queryKey: ["grid-cells", roundId] }),
      queryClient.invalidateQueries({ queryKey: ["quotes"] }),
      queryClient.invalidateQueries({ queryKey: ["canvas"] }),
      ...cellIds.map((cellId) =>
        queryClient.invalidateQueries({ queryKey: ["cell-insights", cellId] })
      ),
    ]);

    if (result.failed.length > 0) {
      toast.error(
        `${result.accepted} accepted. ${result.failed.length} failed — retry individually.`
      );
    } else {
      toast.success(`${result.accepted} insights accepted.`, {
        action: {
          label: "View on canvas →",
          onClick: () => router.push(`/canvas/round/${roundId}?tab=canvas`),
        },
      });
    }

    return result;
  };

  return { bulkAccept, progress };
}

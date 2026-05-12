import { useMutation } from "@tanstack/react-query";
import { readErrorMessage } from "@/hooks/api";

export type ResearchSessionType = "literature" | "analysis";

export interface ResearchRequest {
  query: string;
}

export function useStartResearchStream(sessionType: ResearchSessionType) {
  return useMutation({
    mutationFn: async (payload: ResearchRequest) => {
      const response = await fetch(`/api/research/${sessionType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      return response;
    },
  });
}

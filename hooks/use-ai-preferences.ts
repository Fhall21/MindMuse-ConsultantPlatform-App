import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { UserAIPreferences } from "@/types/db";
import type { AIPreferencesFormData } from "@/lib/validations/ai-preferences";

type AIPreferencesResponse = UserAIPreferences & { signalCount: number };

export function useAIPreferences() {
  return useQuery({
    queryKey: ["ai-preferences"],
    queryFn: () =>
      fetchJson<AIPreferencesResponse>("/api/client/ai-preferences"),
  });
}

export function useUpdateAIPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AIPreferencesFormData) =>
      fetchJson<UserAIPreferences>("/api/client/ai-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-preferences"] });
    },
  });
}

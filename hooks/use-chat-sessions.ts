"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { ChatSessionSummary } from "@/lib/chat/context";

export type { ChatSessionSummary };

export function useChatSessions() {
  return useQuery({
    queryKey: ["chat-sessions"],
    queryFn: () => fetchJson<{ sessions: ChatSessionSummary[] }>("/api/chat/sessions"),
    select: (data) => data.sessions,
    staleTime: 10_000,
  });
}

export function useCreateChatSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload?: { consultationId?: string }) =>
      fetchJson<{ sessionId: string }>("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
    },
  });
}

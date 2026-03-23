import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/hooks/api";
import type { AIInsightLearning, AILearningTopicType } from "@/types/db";

export interface AILearningsResponse {
  topic_type: AILearningTopicType;
  learnings: AIInsightLearning[];
}

export function useAILearnings(
  topicType: AILearningTopicType = "theme_generation"
) {
  return useQuery({
    queryKey: ["ai-learnings", topicType],
    queryFn: () =>
      fetchJson<AILearningsResponse>(
        `/api/user/ai-learnings?topic_type=${encodeURIComponent(topicType)}`
      ),
  });
}

import type { AILearningTopicType } from "@/types/db";

export const DEFAULT_AI_LEARNING_TOPIC_TYPE: AILearningTopicType =
  "theme_generation";

export const AI_LEARNING_TOPIC_TYPES = [
  DEFAULT_AI_LEARNING_TOPIC_TYPE,
] as const satisfies readonly AILearningTopicType[];
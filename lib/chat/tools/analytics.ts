import { z } from "zod";

export const ANALYTICS_INTENTS = [
  "count_themes_by_keyword",
  "group_theme_count",
  "quotes_by_meeting",
  "cross_meeting_themes",
  "person_mention_count",
  "themes_by_person",
  "group_outlier_themes",
  "meeting_activity_summary",
] as const;

export type AnalyticsIntent = (typeof ANALYTICS_INTENTS)[number];

export const VALID_INTENTS_LIST = ANALYTICS_INTENTS.join(", ");

export const queryConsultationDataSchema = z.object({
  intent: z.enum(ANALYTICS_INTENTS),
  filters: z.object({
    consultation_id: z.string().uuid(),
    meeting_id: z.string().uuid().optional(),
    group_id: z.string().uuid().optional(),
    keyword: z.string().optional(),
    person_id: z.string().optional(),
  }),
});

export type ConsultationDataQuery = z.infer<typeof queryConsultationDataSchema>;

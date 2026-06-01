import { z } from "zod";

export const groupThemesSchema = z.object({
  project_id: z.string().uuid(),
  hint: z.string().optional(),
});

export const confirmGroupingSchema = z.object({
  group_name: z.string().min(1),
  group_description: z.string(),
  theme_ids: z.array(z.string().uuid()).min(1),
  consultation_id: z.string().uuid().optional(),
});

export const groupingThemeOptionSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  description: z.string(),
});

export type GroupingThemeOption = z.infer<typeof groupingThemeOptionSchema>;

export interface GroupingReviewOutput {
  consultation_id: string;
  group_name: string;
  group_description: string;
  theme_ids: string[];
  rationale: string;
  available_themes: GroupingThemeOption[];
}

export interface ThemeGroupRecord {
  id: string;
  name: string;
  description: string;
  themeIds: string[];
}

export function buildGroupingReviewOutput(params: {
  consultationId: string;
  groupName: string;
  groupDescription: string;
  themeIds: string[];
  rationale: string;
  availableThemes: GroupingThemeOption[];
}): GroupingReviewOutput {
  return {
    consultation_id: params.consultationId,
    group_name: params.groupName,
    group_description: params.groupDescription,
    theme_ids: params.themeIds,
    rationale: params.rationale,
    available_themes: params.availableThemes,
  };
}

export function readGroupingReviewOutput(output: unknown): GroupingReviewOutput | null {
  if (!output || typeof output !== "object") {
    return null;
  }

  const record = output as Record<string, unknown>;
  if (typeof record.consultation_id !== "string") {
    return null;
  }

  const availableRaw = record.available_themes;
  const availableThemes: GroupingThemeOption[] = [];
  if (Array.isArray(availableRaw)) {
    for (const item of availableRaw) {
      const parsed = groupingThemeOptionSchema.safeParse(item);
      if (parsed.success) {
        availableThemes.push(parsed.data);
      }
    }
  }

  const themeIdsRaw = record.theme_ids;
  const themeIds = Array.isArray(themeIdsRaw)
    ? themeIdsRaw.filter((id): id is string => typeof id === "string")
    : [];

  if (
    typeof record.group_name !== "string" ||
    typeof record.group_description !== "string" ||
    typeof record.rationale !== "string"
  ) {
    return null;
  }

  return {
    consultation_id: record.consultation_id,
    group_name: record.group_name,
    group_description: record.group_description,
    theme_ids: themeIds,
    rationale: record.rationale,
    available_themes: availableThemes,
  };
}

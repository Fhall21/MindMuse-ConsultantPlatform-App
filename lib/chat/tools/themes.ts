import { z } from "zod";

export const extractThemesSchema = z.object({
  meeting_id: z.string().uuid(),
});

export const confirmThemesSchema = z.object({
  meeting_id: z.string().uuid(),
  accepted_theme_ids: z.array(z.string().uuid()),
  rejected_theme_ids: z.array(z.string().uuid()),
});

export const themeReviewItemSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  description: z.string(),
  source_quotes: z.array(z.string()),
  confidence: z.number(),
});

export type ThemeReviewItem = z.infer<typeof themeReviewItemSchema>;

export type ThemeDecision = "accepted" | "rejected";

export interface ThemeReviewOutput {
  meeting_id: string;
  themes: ThemeReviewItem[];
  decisions: Record<string, ThemeDecision>;
}

export interface ExtractedThemeDraft {
  label: string;
  description: string;
  confidence: number;
}

export function normalizeExtractedThemes(raw: unknown): ExtractedThemeDraft[] {
  const payload =
    raw && typeof raw === "object" && "themes" in raw
      ? (raw as { themes?: unknown }).themes
      : raw;

  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const record = item as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label.trim() : "";
      if (!label) {
        return null;
      }
      const description =
        typeof record.description === "string" ? record.description.trim() : "";
      const confidence =
        typeof record.confidence === "number" && Number.isFinite(record.confidence)
          ? record.confidence
          : 0.5;

      return { label, description, confidence };
    })
    .filter((item): item is ExtractedThemeDraft => item !== null);
}

export function buildThemeReviewOutput(params: {
  meetingId: string;
  themes: ThemeReviewItem[];
  decisions?: Record<string, ThemeDecision>;
}): ThemeReviewOutput {
  return {
    meeting_id: params.meetingId,
    themes: params.themes,
    decisions: params.decisions ?? {},
  };
}

export function readThemeReviewOutput(output: unknown): ThemeReviewOutput | null {
  if (!output || typeof output !== "object") {
    return null;
  }

  const record = output as Record<string, unknown>;
  if (typeof record.meeting_id !== "string") {
    return null;
  }

  const themesRaw = record.themes;
  if (!Array.isArray(themesRaw)) {
    return null;
  }

  const themes: ThemeReviewItem[] = [];
  for (const item of themesRaw) {
    const parsed = themeReviewItemSchema.safeParse(item);
    if (parsed.success) {
      themes.push(parsed.data);
    }
  }

  if (themes.length === 0) {
    return null;
  }

  const decisionsRaw = record.decisions ?? record.theme_decisions;
  const decisions: Record<string, ThemeDecision> = {};
  if (decisionsRaw && typeof decisionsRaw === "object") {
    for (const [key, value] of Object.entries(decisionsRaw)) {
      if (value === "accepted" || value === "rejected") {
        decisions[key] = value;
      }
    }
  }

  return {
    meeting_id: record.meeting_id,
    themes,
    decisions,
  };
}

export { getConfidenceLabel } from "@/lib/insights/confidence";

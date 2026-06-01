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

export function getConfidenceLabel(confidence: number | undefined): {
  label: string;
  className: string;
} {
  if (confidence === undefined || Number.isNaN(confidence)) {
    return { label: "Pending review", className: "text-muted-foreground" };
  }

  if (confidence >= 0.7) {
    return {
      label: "High confidence",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    };
  }

  if (confidence >= 0.4) {
    return {
      label: "Medium confidence",
      className:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
    };
  }

  return {
    label: "Low confidence",
    className:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
  };
}

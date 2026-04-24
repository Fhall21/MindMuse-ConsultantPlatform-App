"use server";

import { requireCurrentUserId } from "@/lib/data/auth-context";
import {
  acceptDigitalInterviewTheme,
  rejectDigitalInterviewTheme,
  saveDigitalInterviewThemes,
} from "@/lib/data/digital-interview-themes";

export async function saveDigitalInterviewThemesAction(
  flowId: string,
  themes: Array<{ label: string; description?: string | null }>
) {
  const userId = await requireCurrentUserId();
  return saveDigitalInterviewThemes(flowId, userId, themes);
}

export async function acceptDigitalInterviewThemeAction(themeId: string, flowId: string) {
  const userId = await requireCurrentUserId();
  return acceptDigitalInterviewTheme(themeId, flowId, userId);
}

export async function rejectDigitalInterviewThemeAction(themeId: string, flowId: string) {
  const userId = await requireCurrentUserId();
  return rejectDigitalInterviewTheme(themeId, flowId, userId);
}

"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userAIPreferences } from "@/db/schema";
import { getCurrentUserId } from "./auth-context";

export interface UserAIPreferencesPayload {
  consultation_types: string[];
  focus_areas: string[];
  excluded_topics: string[];
}

export async function loadUserAIPreferences() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return null as UserAIPreferencesPayload | null;
  }

  const rows = await db
    .select({
      consultationTypes: userAIPreferences.consultationTypes,
      focusAreas: userAIPreferences.focusAreas,
      excludedTopics: userAIPreferences.excludedTopics,
    })
    .from(userAIPreferences)
    .where(eq(userAIPreferences.userId, userId))
    .limit(1);

  const preferences = rows[0];
  if (!preferences) {
    return null;
  }

  return {
    consultation_types: preferences.consultationTypes,
    focus_areas: preferences.focusAreas,
    excluded_topics: preferences.excludedTopics,
  } satisfies UserAIPreferencesPayload;
}
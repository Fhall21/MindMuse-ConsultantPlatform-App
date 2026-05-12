"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userAIPreferences } from "@/db/schema";
import { getCurrentUserId } from "./auth-context";

export interface UserAIPreferencesPayload {
  consultation_types: string[];
  focus_areas: string[];
  industry: string;
  excluded_topics: string[];
  email_guidance: string;
  anonymous_mode: boolean;
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
      industry: userAIPreferences.industry,
      excludedTopics: userAIPreferences.excludedTopics,
      emailGuidance: userAIPreferences.emailGuidance,
      anonymousMode: userAIPreferences.anonymousMode,
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
    industry: preferences.industry,
    excluded_topics: preferences.excludedTopics,
    email_guidance: preferences.emailGuidance,
    anonymous_mode: preferences.anonymousMode,
  } satisfies UserAIPreferencesPayload;
}

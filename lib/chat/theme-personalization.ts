import { loadUserAILearnings } from "@/lib/data/ai-learnings";
import { loadRecentThemeLearningSignals } from "@/lib/data/theme-learning";
import { loadUserAIPreferences } from "@/lib/data/user-ai-preferences";

/** Mirrors app/api/themes/extract/route.ts personalization loaders. */
export async function loadThemePersonalizationContext(userId: string) {
  let learningSignals: Awaited<ReturnType<typeof loadRecentThemeLearningSignals>> = [];
  let aiLearnings: Awaited<ReturnType<typeof loadUserAILearnings>> = [];
  let userPreferences: Awaited<ReturnType<typeof loadUserAIPreferences>> = null;

  try {
    [learningSignals, aiLearnings, userPreferences] = await Promise.all([
      loadRecentThemeLearningSignals(),
      loadUserAILearnings(userId),
      loadUserAIPreferences(),
    ]);
  } catch (error) {
    console.error("[chat.themes] failed to load personalization context", error);
  }

  return {
    learning_signals: learningSignals,
    ai_learnings: aiLearnings,
    user_preferences: userPreferences,
  };
}

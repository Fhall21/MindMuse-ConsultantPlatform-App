ALTER TABLE "user_ai_preferences" ADD COLUMN "next_learning_analysis_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_ai_preferences_next_learning_at"
  ON "user_ai_preferences" ("next_learning_analysis_at")
  WHERE "next_learning_analysis_at" IS NOT NULL;

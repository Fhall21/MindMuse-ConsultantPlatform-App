-- Fix: rename theme_id/theme_label → insight_id/insight_label in insight_decision_logs.
-- 0001 was applied to production before these renames were added to it.
-- Idempotent: safe on fresh DBs and local where columns are already correct.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'insight_decision_logs'
      AND column_name = 'theme_id'
  ) THEN
    ALTER TABLE "insight_decision_logs" RENAME COLUMN "theme_id" TO "insight_id";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'insight_decision_logs'
      AND column_name = 'theme_label'
  ) THEN
    ALTER TABLE "insight_decision_logs" RENAME COLUMN "theme_label" TO "insight_label";
  END IF;
END
$$;

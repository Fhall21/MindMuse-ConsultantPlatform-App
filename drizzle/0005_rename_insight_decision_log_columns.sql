-- Rename legacy columns in insight_decision_logs
-- When theme_decision_logs was renamed to insight_decision_logs in 0001,
-- the columns theme_id and theme_label were not renamed.
-- This migration completes that rename.

ALTER TABLE "insight_decision_logs"
  RENAME COLUMN "theme_id" TO "insight_id";

ALTER TABLE "insight_decision_logs"
  RENAME COLUMN "theme_label" TO "insight_label";

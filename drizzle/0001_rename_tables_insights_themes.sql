-- Rename themes to insights
ALTER TABLE "themes" RENAME TO "insights";

-- Rename theme_decision_logs to insight_decision_logs
ALTER TABLE "theme_decision_logs" RENAME TO "insight_decision_logs";

-- Rename columns in insight_decision_logs to match new semantic meaning
ALTER TABLE "insight_decision_logs" RENAME COLUMN "theme_id" TO "insight_id";
ALTER TABLE "insight_decision_logs" RENAME COLUMN "theme_label" TO "insight_label";

-- Rename round_theme_groups to themes
ALTER TABLE "round_theme_groups" RENAME TO "themes";

-- Rename round_theme_group_members to theme_members and swap column names:
-- theme_id → insight_id, group_id → theme_id
ALTER TABLE "round_theme_group_members" RENAME TO "theme_members";
-- Use temporary column to avoid conflict
ALTER TABLE "theme_members" RENAME COLUMN "theme_id" TO "_insight_id_temp";
ALTER TABLE "theme_members" RENAME COLUMN "group_id" TO "theme_id";
ALTER TABLE "theme_members" RENAME COLUMN "_insight_id_temp" TO "insight_id";

-- Update constraint name
ALTER TABLE "theme_members" RENAME CONSTRAINT "round_theme_group_members_round_theme_key" TO "theme_members_round_insight_key";

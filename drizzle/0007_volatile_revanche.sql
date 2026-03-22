ALTER TABLE "round_cross_insights" RENAME TO "consultation_cross_insights";--> statement-breakpoint
ALTER TABLE "round_decisions" RENAME TO "consultation_decisions";--> statement-breakpoint
ALTER TABLE "round_output_artifacts" RENAME TO "consultation_output_artifacts";--> statement-breakpoint
ALTER TABLE "consultation_rounds" RENAME TO "consultations";--> statement-breakpoint
ALTER TABLE "consultation_groups" RENAME TO "meeting_groups";--> statement-breakpoint
ALTER TABLE "analytics_jobs" RENAME COLUMN "round_id" TO "consultation_id";--> statement-breakpoint
ALTER TABLE "analytics_outbox" RENAME COLUMN "round_id" TO "consultation_id";--> statement-breakpoint
ALTER TABLE "canvas_connections" RENAME COLUMN "round_id" TO "consultation_id";--> statement-breakpoint
ALTER TABLE "canvas_layout_state" RENAME COLUMN "round_id" TO "consultation_id";--> statement-breakpoint
ALTER TABLE "consultation_group_members" RENAME COLUMN "round_id" TO "consultation_id";--> statement-breakpoint
ALTER TABLE "meeting_groups" RENAME COLUMN "round_id" TO "consultation_id";--> statement-breakpoint
ALTER TABLE "extraction_results" RENAME COLUMN "round_id" TO "consultation_id";--> statement-breakpoint
ALTER TABLE "insight_decision_logs" RENAME COLUMN "round_id" TO "consultation_id";--> statement-breakpoint
ALTER TABLE "meetings" RENAME COLUMN "round_id" TO "consultation_id";--> statement-breakpoint
ALTER TABLE "consultation_cross_insights" RENAME COLUMN "round_id" TO "consultation_id";--> statement-breakpoint
ALTER TABLE "consultation_cross_insights" RENAME COLUMN "source_consultation_ids" TO "source_meeting_ids";--> statement-breakpoint
ALTER TABLE "consultation_decisions" RENAME COLUMN "round_id" TO "consultation_id";--> statement-breakpoint
ALTER TABLE "consultation_output_artifacts" RENAME COLUMN "round_id" TO "consultation_id";--> statement-breakpoint
ALTER TABLE "term_cluster_memberships" RENAME COLUMN "round_id" TO "consultation_id";--> statement-breakpoint
ALTER TABLE "term_clusters" RENAME COLUMN "round_id" TO "consultation_id";--> statement-breakpoint
ALTER TABLE "theme_members" RENAME COLUMN "round_id" TO "consultation_id";--> statement-breakpoint
ALTER TABLE "themes" RENAME COLUMN "round_id" TO "consultation_id";--> statement-breakpoint
ALTER TABLE "canvas_connections" DROP CONSTRAINT "canvas_connections_typed_edge_unique";--> statement-breakpoint
ALTER TABLE "canvas_layout_state" DROP CONSTRAINT "canvas_layout_state_node_unique";--> statement-breakpoint
ALTER TABLE "consultation_group_members" DROP CONSTRAINT "consultation_group_members_round_meeting_key";--> statement-breakpoint
ALTER TABLE "term_cluster_memberships" DROP CONSTRAINT "term_cluster_memberships_round_meeting_term_key";--> statement-breakpoint
ALTER TABLE "term_clusters" DROP CONSTRAINT "term_clusters_round_cluster_key";--> statement-breakpoint
ALTER TABLE "theme_members" DROP CONSTRAINT "theme_members_round_insight_key";--> statement-breakpoint
ALTER TABLE "meeting_groups" DROP CONSTRAINT "consultation_groups_position_check";--> statement-breakpoint
ALTER TABLE "consultation_decisions" DROP CONSTRAINT "round_decisions_target_type_check";--> statement-breakpoint
ALTER TABLE "consultation_decisions" DROP CONSTRAINT "round_decisions_decision_type_check";--> statement-breakpoint
ALTER TABLE "consultation_decisions" DROP CONSTRAINT "round_decisions_management_rejected_requires_rationale";--> statement-breakpoint
ALTER TABLE "consultation_output_artifacts" DROP CONSTRAINT "round_output_artifacts_artifact_type_check";--> statement-breakpoint
ALTER TABLE "consultation_output_artifacts" DROP CONSTRAINT "round_output_artifacts_status_check";--> statement-breakpoint
ALTER TABLE "analytics_jobs" DROP CONSTRAINT IF EXISTS "analytics_jobs_round_id_consultation_rounds_id_fk";
--> statement-breakpoint
ALTER TABLE "analytics_jobs" DROP CONSTRAINT IF EXISTS "analytics_jobs_round_id_fkey";
--> statement-breakpoint
ALTER TABLE "analytics_outbox" DROP CONSTRAINT IF EXISTS "analytics_outbox_round_id_consultation_rounds_id_fk";
--> statement-breakpoint
ALTER TABLE "analytics_outbox" DROP CONSTRAINT IF EXISTS "analytics_outbox_round_id_fkey";
--> statement-breakpoint
ALTER TABLE "canvas_connections" DROP CONSTRAINT IF EXISTS "canvas_connections_round_id_consultation_rounds_id_fk";
--> statement-breakpoint
ALTER TABLE "canvas_connections" DROP CONSTRAINT IF EXISTS "canvas_connections_round_id_fkey";
--> statement-breakpoint
ALTER TABLE "canvas_layout_state" DROP CONSTRAINT IF EXISTS "canvas_layout_state_round_id_consultation_rounds_id_fk";
--> statement-breakpoint
ALTER TABLE "canvas_layout_state" DROP CONSTRAINT IF EXISTS "canvas_layout_state_round_id_fkey";
--> statement-breakpoint
ALTER TABLE "consultation_group_members" DROP CONSTRAINT "consultation_group_members_group_id_consultation_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "consultation_group_members" DROP CONSTRAINT "consultation_group_members_round_id_consultation_rounds_id_fk";
--> statement-breakpoint
ALTER TABLE "meeting_groups" DROP CONSTRAINT "consultation_groups_round_id_consultation_rounds_id_fk";
--> statement-breakpoint
ALTER TABLE "meeting_groups" DROP CONSTRAINT "consultation_groups_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "meeting_groups" DROP CONSTRAINT "consultation_groups_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "consultations" DROP CONSTRAINT "consultation_rounds_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "extraction_results" DROP CONSTRAINT IF EXISTS "extraction_results_round_id_consultation_rounds_id_fk";
--> statement-breakpoint
ALTER TABLE "extraction_results" DROP CONSTRAINT IF EXISTS "extraction_results_round_id_fkey";
--> statement-breakpoint
ALTER TABLE "insight_decision_logs" DROP CONSTRAINT IF EXISTS "insight_decision_logs_round_id_consultation_rounds_id_fk";
--> statement-breakpoint
ALTER TABLE "insight_decision_logs" DROP CONSTRAINT IF EXISTS "theme_decision_logs_round_id_consultation_rounds_id_fk";
--> statement-breakpoint
ALTER TABLE "meetings" DROP CONSTRAINT "meetings_round_id_consultation_rounds_id_fk";
--> statement-breakpoint
ALTER TABLE "consultation_cross_insights" DROP CONSTRAINT "round_cross_insights_round_id_consultation_rounds_id_fk";
--> statement-breakpoint
ALTER TABLE "consultation_cross_insights" DROP CONSTRAINT "round_cross_insights_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "consultation_decisions" DROP CONSTRAINT "round_decisions_round_id_consultation_rounds_id_fk";
--> statement-breakpoint
ALTER TABLE "consultation_decisions" DROP CONSTRAINT "round_decisions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "consultation_output_artifacts" DROP CONSTRAINT "round_output_artifacts_round_id_consultation_rounds_id_fk";
--> statement-breakpoint
ALTER TABLE "consultation_output_artifacts" DROP CONSTRAINT "round_output_artifacts_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "consultation_output_artifacts" DROP CONSTRAINT "round_output_artifacts_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "term_cluster_memberships" DROP CONSTRAINT IF EXISTS "term_cluster_memberships_round_id_consultation_rounds_id_fk";
--> statement-breakpoint
ALTER TABLE "term_cluster_memberships" DROP CONSTRAINT IF EXISTS "term_cluster_memberships_round_id_fkey";
--> statement-breakpoint
ALTER TABLE "term_clusters" DROP CONSTRAINT IF EXISTS "term_clusters_round_id_consultation_rounds_id_fk";
--> statement-breakpoint
ALTER TABLE "term_clusters" DROP CONSTRAINT IF EXISTS "term_clusters_round_id_fkey";
--> statement-breakpoint
ALTER TABLE "theme_members" DROP CONSTRAINT IF EXISTS "theme_members_round_id_consultation_rounds_id_fk";
--> statement-breakpoint
ALTER TABLE "theme_members" DROP CONSTRAINT IF EXISTS "round_theme_group_members_round_id_consultation_rounds_id_fk";
--> statement-breakpoint
ALTER TABLE "themes" DROP CONSTRAINT IF EXISTS "themes_round_id_consultation_rounds_id_fk";
--> statement-breakpoint
ALTER TABLE "themes" DROP CONSTRAINT IF EXISTS "round_theme_groups_round_id_consultation_rounds_id_fk";
--> statement-breakpoint
DROP INDEX "idx_analytics_jobs_round_created";--> statement-breakpoint
DROP INDEX "idx_canvas_connections_round_id";--> statement-breakpoint
DROP INDEX "idx_canvas_connections_round_user";--> statement-breakpoint
DROP INDEX "idx_canvas_layout_state_round_user";--> statement-breakpoint
DROP INDEX "idx_consultation_group_members_round_id";--> statement-breakpoint
DROP INDEX "idx_consultation_groups_round_id";--> statement-breakpoint
DROP INDEX "idx_consultation_groups_user_round";--> statement-breakpoint
DROP INDEX "idx_consultation_rounds_user_id";--> statement-breakpoint
DROP INDEX "idx_extraction_results_round_extracted";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_insight_decision_logs_round_id";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_theme_decision_logs_round_id";--> statement-breakpoint
DROP INDEX "idx_meetings_round_id";--> statement-breakpoint
DROP INDEX "idx_round_cross_insights_round_id";--> statement-breakpoint
DROP INDEX "idx_round_cross_insights_created_by";--> statement-breakpoint
DROP INDEX "idx_round_decisions_round_target";--> statement-breakpoint
DROP INDEX "idx_round_output_artifacts_round_type";--> statement-breakpoint
DROP INDEX "idx_term_cluster_memberships_round_cluster";--> statement-breakpoint
DROP INDEX "idx_term_clusters_round_clustered";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_theme_members_round_id";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_round_theme_group_members_round_id";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_themes_round_id";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_round_theme_groups_round_id";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_themes_user_round_status";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_round_theme_groups_user_round_status";--> statement-breakpoint
DROP INDEX "idx_canvas_connections_origin_pending";--> statement-breakpoint
ALTER TABLE "analytics_jobs" ADD CONSTRAINT "analytics_jobs_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_outbox" ADD CONSTRAINT "analytics_outbox_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_connections" ADD CONSTRAINT "canvas_connections_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_layout_state" ADD CONSTRAINT "canvas_layout_state_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_group_members" ADD CONSTRAINT "consultation_group_members_group_id_meeting_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."meeting_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_group_members" ADD CONSTRAINT "consultation_group_members_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_groups" ADD CONSTRAINT "meeting_groups_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_groups" ADD CONSTRAINT "meeting_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_groups" ADD CONSTRAINT "meeting_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_results" ADD CONSTRAINT "extraction_results_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_decision_logs" ADD CONSTRAINT "insight_decision_logs_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_cross_insights" ADD CONSTRAINT "consultation_cross_insights_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_cross_insights" ADD CONSTRAINT "consultation_cross_insights_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_decisions" ADD CONSTRAINT "consultation_decisions_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_decisions" ADD CONSTRAINT "consultation_decisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_output_artifacts" ADD CONSTRAINT "consultation_output_artifacts_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_output_artifacts" ADD CONSTRAINT "consultation_output_artifacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_output_artifacts" ADD CONSTRAINT "consultation_output_artifacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_cluster_memberships" ADD CONSTRAINT "term_cluster_memberships_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_clusters" ADD CONSTRAINT "term_clusters_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_members" ADD CONSTRAINT "theme_members_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_analytics_jobs_consultation_created" ON "analytics_jobs" USING btree ("consultation_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_canvas_connections_consultation_id" ON "canvas_connections" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "idx_canvas_connections_consultation_user" ON "canvas_connections" USING btree ("consultation_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_canvas_layout_state_consultation_user" ON "canvas_layout_state" USING btree ("consultation_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_consultation_group_members_consultation_id" ON "consultation_group_members" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_groups_consultation_id" ON "meeting_groups" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_groups_user_consultation" ON "meeting_groups" USING btree ("user_id","consultation_id");--> statement-breakpoint
CREATE INDEX "idx_consultations_user_id" ON "consultations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_extraction_results_consultation_extracted" ON "extraction_results" USING btree ("consultation_id","extracted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_insight_decision_logs_consultation_id" ON "insight_decision_logs" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "idx_meetings_consultation_id" ON "meetings" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "idx_consultation_cross_insights_consultation_id" ON "consultation_cross_insights" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "idx_consultation_cross_insights_created_by" ON "consultation_cross_insights" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_consultation_decisions_consultation_target" ON "consultation_decisions" USING btree ("consultation_id","target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_consultation_output_artifacts_consultation_type" ON "consultation_output_artifacts" USING btree ("consultation_id","artifact_type","generated_at");--> statement-breakpoint
CREATE INDEX "idx_term_cluster_memberships_consultation_cluster" ON "term_cluster_memberships" USING btree ("consultation_id","cluster_id");--> statement-breakpoint
CREATE INDEX "idx_term_clusters_consultation_clustered" ON "term_clusters" USING btree ("consultation_id","clustered_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_theme_members_consultation_id" ON "theme_members" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "idx_themes_consultation_id" ON "themes" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "idx_themes_user_consultation_status" ON "themes" USING btree ("user_id","consultation_id","status");--> statement-breakpoint
CREATE INDEX "idx_canvas_connections_origin_pending" ON "canvas_connections" USING btree ("consultation_id","origin");--> statement-breakpoint
ALTER TABLE "canvas_connections" ADD CONSTRAINT "canvas_connections_typed_edge_unique" UNIQUE("consultation_id","from_node_type","from_node_id","to_node_type","to_node_id","connection_type");--> statement-breakpoint
ALTER TABLE "canvas_layout_state" ADD CONSTRAINT "canvas_layout_state_node_unique" UNIQUE("consultation_id","user_id","node_type","node_id");--> statement-breakpoint
ALTER TABLE "consultation_group_members" ADD CONSTRAINT "consultation_group_members_consultation_meeting_key" UNIQUE("consultation_id","meeting_id");--> statement-breakpoint
ALTER TABLE "term_cluster_memberships" ADD CONSTRAINT "term_cluster_memberships_consultation_meeting_term_key" UNIQUE("consultation_id","meeting_id","term");--> statement-breakpoint
ALTER TABLE "term_clusters" ADD CONSTRAINT "term_clusters_consultation_cluster_key" UNIQUE("consultation_id","cluster_id");--> statement-breakpoint
ALTER TABLE "theme_members" ADD CONSTRAINT "theme_members_consultation_insight_key" UNIQUE("consultation_id","insight_id");--> statement-breakpoint
ALTER TABLE "meeting_groups" ADD CONSTRAINT "meeting_groups_position_check" CHECK ("meeting_groups"."position" >= 0);--> statement-breakpoint
ALTER TABLE "consultation_decisions" ADD CONSTRAINT "consultation_decisions_target_type_check" CHECK ("consultation_decisions"."target_type" in ('source_theme', 'theme_group', 'round_output'));--> statement-breakpoint
ALTER TABLE "consultation_decisions" ADD CONSTRAINT "consultation_decisions_decision_type_check" CHECK ("consultation_decisions"."decision_type" in ('accepted', 'discarded', 'management_rejected'));--> statement-breakpoint
ALTER TABLE "consultation_decisions" ADD CONSTRAINT "consultation_decisions_management_rejected_requires_rationale" CHECK ("consultation_decisions"."decision_type" <> 'management_rejected' or ("consultation_decisions"."rationale" is not null and btrim("consultation_decisions"."rationale") <> ''));--> statement-breakpoint
ALTER TABLE "consultation_output_artifacts" ADD CONSTRAINT "consultation_output_artifacts_artifact_type_check" CHECK ("consultation_output_artifacts"."artifact_type" in ('summary', 'report', 'email'));--> statement-breakpoint
ALTER TABLE "consultation_output_artifacts" ADD CONSTRAINT "consultation_output_artifacts_status_check" CHECK ("consultation_output_artifacts"."status" in ('generated'));
ALTER TABLE "consultation_people" RENAME TO "meeting_people";--> statement-breakpoint
ALTER TABLE "consultations" RENAME TO "meetings";--> statement-breakpoint
ALTER TABLE "analytics_jobs" RENAME COLUMN "consultation_id" TO "meeting_id";--> statement-breakpoint
ALTER TABLE "analytics_outbox" RENAME COLUMN "consultation_id" TO "meeting_id";--> statement-breakpoint
ALTER TABLE "audit_log" RENAME COLUMN "consultation_id" TO "meeting_id";--> statement-breakpoint
ALTER TABLE "consultation_group_members" RENAME COLUMN "consultation_id" TO "meeting_id";--> statement-breakpoint
ALTER TABLE "meeting_people" RENAME COLUMN "consultation_id" TO "meeting_id";--> statement-breakpoint
ALTER TABLE "evidence_emails" RENAME COLUMN "consultation_id" TO "meeting_id";--> statement-breakpoint
ALTER TABLE "extraction_results" RENAME COLUMN "consultation_id" TO "meeting_id";--> statement-breakpoint
ALTER TABLE "ingestion_artifacts" RENAME COLUMN "consultation_id" TO "meeting_id";--> statement-breakpoint
ALTER TABLE "insight_decision_logs" RENAME COLUMN "consultation_id" TO "meeting_id";--> statement-breakpoint
ALTER TABLE "insights" RENAME COLUMN "consultation_id" TO "meeting_id";--> statement-breakpoint
ALTER TABLE "ocr_jobs" RENAME COLUMN "consultation_id" TO "meeting_id";--> statement-breakpoint
ALTER TABLE "phases" RENAME COLUMN "consultation_id" TO "meeting_id";--> statement-breakpoint
ALTER TABLE "term_cluster_memberships" RENAME COLUMN "consultation_id" TO "meeting_id";--> statement-breakpoint
ALTER TABLE "term_embeddings" RENAME COLUMN "consultation_id" TO "meeting_id";--> statement-breakpoint
ALTER TABLE "term_extraction_offsets" RENAME COLUMN "consultation_id" TO "meeting_id";--> statement-breakpoint
ALTER TABLE "theme_members" RENAME COLUMN "source_consultation_id" TO "source_meeting_id";--> statement-breakpoint
ALTER TABLE "transcription_jobs" RENAME COLUMN "consultation_id" TO "meeting_id";--> statement-breakpoint
ALTER TABLE "consultation_group_members" DROP CONSTRAINT "consultation_group_members_round_consultation_key";--> statement-breakpoint
ALTER TABLE "term_cluster_memberships" DROP CONSTRAINT "term_cluster_memberships_round_consultation_term_key";--> statement-breakpoint
ALTER TABLE "term_embeddings" DROP CONSTRAINT "term_embeddings_consultation_term_entity_key";--> statement-breakpoint
ALTER TABLE "meetings" DROP CONSTRAINT "consultations_status_check";--> statement-breakpoint
ALTER TABLE "analytics_jobs" DROP CONSTRAINT IF EXISTS "analytics_jobs_consultation_id_consultations_id_fk";
--> statement-breakpoint
ALTER TABLE "analytics_jobs" DROP CONSTRAINT IF EXISTS "analytics_jobs_consultation_id_fkey";
--> statement-breakpoint
ALTER TABLE "analytics_outbox" DROP CONSTRAINT IF EXISTS "analytics_outbox_consultation_id_consultations_id_fk";
--> statement-breakpoint
ALTER TABLE "analytics_outbox" DROP CONSTRAINT IF EXISTS "analytics_outbox_consultation_id_fkey";
--> statement-breakpoint
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_consultation_id_consultations_id_fk";
--> statement-breakpoint
ALTER TABLE "consultation_group_members" DROP CONSTRAINT "consultation_group_members_consultation_id_consultations_id_fk";
--> statement-breakpoint
ALTER TABLE "meeting_people" DROP CONSTRAINT "consultation_people_consultation_id_consultations_id_fk";
--> statement-breakpoint
ALTER TABLE "meeting_people" DROP CONSTRAINT "consultation_people_person_id_people_id_fk";
--> statement-breakpoint
ALTER TABLE "meetings" DROP CONSTRAINT "consultations_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "meetings" DROP CONSTRAINT "consultations_round_id_consultation_rounds_id_fk";
--> statement-breakpoint
ALTER TABLE "evidence_emails" DROP CONSTRAINT "evidence_emails_consultation_id_consultations_id_fk";
--> statement-breakpoint
ALTER TABLE "extraction_results" DROP CONSTRAINT IF EXISTS "extraction_results_consultation_id_consultations_id_fk";
--> statement-breakpoint
ALTER TABLE "extraction_results" DROP CONSTRAINT IF EXISTS "extraction_results_consultation_id_fkey";
--> statement-breakpoint
ALTER TABLE "ingestion_artifacts" DROP CONSTRAINT "ingestion_artifacts_consultation_id_consultations_id_fk";
--> statement-breakpoint
ALTER TABLE "insight_decision_logs" DROP CONSTRAINT IF EXISTS "insight_decision_logs_consultation_id_consultations_id_fk";
--> statement-breakpoint
ALTER TABLE "insight_decision_logs" DROP CONSTRAINT IF EXISTS "theme_decision_logs_consultation_id_consultations_id_fk";
--> statement-breakpoint
ALTER TABLE "insights" DROP CONSTRAINT IF EXISTS "insights_consultation_id_consultations_id_fk";
--> statement-breakpoint
ALTER TABLE "insights" DROP CONSTRAINT IF EXISTS "themes_consultation_id_consultations_id_fk";
--> statement-breakpoint
ALTER TABLE "ocr_jobs" DROP CONSTRAINT "ocr_jobs_consultation_id_consultations_id_fk";
--> statement-breakpoint
ALTER TABLE "phases" DROP CONSTRAINT "phases_consultation_id_consultations_id_fk";
--> statement-breakpoint
ALTER TABLE "term_cluster_memberships" DROP CONSTRAINT IF EXISTS "term_cluster_memberships_consultation_id_consultations_id_fk";
--> statement-breakpoint
ALTER TABLE "term_cluster_memberships" DROP CONSTRAINT IF EXISTS "term_cluster_memberships_consultation_id_fkey";
--> statement-breakpoint
ALTER TABLE "term_embeddings" DROP CONSTRAINT IF EXISTS "term_embeddings_consultation_id_consultations_id_fk";
--> statement-breakpoint
ALTER TABLE "term_embeddings" DROP CONSTRAINT IF EXISTS "term_embeddings_consultation_id_fkey";
--> statement-breakpoint
ALTER TABLE "term_extraction_offsets" DROP CONSTRAINT IF EXISTS "term_extraction_offsets_consultation_id_consultations_id_fk";
--> statement-breakpoint
ALTER TABLE "term_extraction_offsets" DROP CONSTRAINT IF EXISTS "term_extraction_offsets_consultation_id_fkey";
--> statement-breakpoint
ALTER TABLE "theme_members" DROP CONSTRAINT IF EXISTS "theme_members_source_consultation_id_consultations_id_fk";
--> statement-breakpoint
ALTER TABLE "theme_members" DROP CONSTRAINT IF EXISTS "round_theme_group_members_source_consultation_id_consultations_id_fk";
--> statement-breakpoint
ALTER TABLE "transcription_jobs" DROP CONSTRAINT "transcription_jobs_consultation_id_consultations_id_fk";
--> statement-breakpoint
DROP INDEX "idx_analytics_jobs_consultation_created";--> statement-breakpoint
DROP INDEX "idx_analytics_jobs_active_consultation";--> statement-breakpoint
DROP INDEX "idx_analytics_outbox_consultation_created";--> statement-breakpoint
DROP INDEX "idx_audit_log_consultation_id";--> statement-breakpoint
DROP INDEX "idx_consultation_group_members_consultation_id";--> statement-breakpoint
DROP INDEX "idx_consultations_user_id";--> statement-breakpoint
DROP INDEX "idx_consultations_status";--> statement-breakpoint
DROP INDEX "idx_consultations_round_id";--> statement-breakpoint
DROP INDEX "idx_evidence_emails_consultation_id";--> statement-breakpoint
DROP INDEX "idx_evidence_emails_consultation_id_status";--> statement-breakpoint
DROP INDEX "idx_extraction_results_consultation_extracted";--> statement-breakpoint
DROP INDEX "idx_ingestion_artifacts_consultation_type";--> statement-breakpoint
DROP INDEX "idx_ingestion_artifacts_consultation_created";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_insight_decision_logs_consultation_id";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_theme_decision_logs_consultation_id";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_insight_decision_logs_user_consultation_created";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_theme_decision_logs_user_consultation_created";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_insights_consultation_id";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_themes_consultation_id";--> statement-breakpoint
DROP INDEX "idx_ocr_jobs_consultation_status";--> statement-breakpoint
DROP INDEX "idx_ocr_jobs_consultation_requested";--> statement-breakpoint
DROP INDEX "idx_phases_consultation_id";--> statement-breakpoint
DROP INDEX "idx_term_cluster_memberships_consultation_id";--> statement-breakpoint
DROP INDEX "idx_term_embeddings_consultation_id";--> statement-breakpoint
DROP INDEX "idx_term_extraction_offsets_consultation_char";--> statement-breakpoint
DROP INDEX "idx_transcription_jobs_consultation_status";--> statement-breakpoint
DROP INDEX "idx_transcription_jobs_consultation_requested";--> statement-breakpoint
DROP INDEX "idx_ingestion_artifacts_accepted";--> statement-breakpoint
ALTER TABLE "meeting_people" DROP CONSTRAINT "consultation_people_consultation_id_person_id_pk";--> statement-breakpoint
ALTER TABLE "meeting_people" ADD CONSTRAINT "meeting_people_meeting_id_person_id_pk" PRIMARY KEY("meeting_id","person_id");--> statement-breakpoint
ALTER TABLE "analytics_jobs" ADD CONSTRAINT "analytics_jobs_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_outbox" ADD CONSTRAINT "analytics_outbox_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_group_members" ADD CONSTRAINT "consultation_group_members_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_people" ADD CONSTRAINT "meeting_people_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_people" ADD CONSTRAINT "meeting_people_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_round_id_consultation_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."consultation_rounds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_emails" ADD CONSTRAINT "evidence_emails_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_results" ADD CONSTRAINT "extraction_results_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_artifacts" ADD CONSTRAINT "ingestion_artifacts_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_decision_logs" ADD CONSTRAINT "insight_decision_logs_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocr_jobs" ADD CONSTRAINT "ocr_jobs_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phases" ADD CONSTRAINT "phases_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_cluster_memberships" ADD CONSTRAINT "term_cluster_memberships_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_embeddings" ADD CONSTRAINT "term_embeddings_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_extraction_offsets" ADD CONSTRAINT "term_extraction_offsets_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_members" ADD CONSTRAINT "theme_members_source_meeting_id_meetings_id_fk" FOREIGN KEY ("source_meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD CONSTRAINT "transcription_jobs_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_analytics_jobs_meeting_created" ON "analytics_jobs" USING btree ("meeting_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_analytics_jobs_active_meeting" ON "analytics_jobs" USING btree ("meeting_id") WHERE "analytics_jobs"."phase" in ('queued', 'extracting', 'embedding', 'clustering', 'syncing');--> statement-breakpoint
CREATE INDEX "idx_analytics_outbox_meeting_created" ON "analytics_outbox" USING btree ("meeting_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_audit_log_meeting_id" ON "audit_log" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "idx_consultation_group_members_meeting_id" ON "consultation_group_members" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "idx_meetings_user_id" ON "meetings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_meetings_status" ON "meetings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_meetings_round_id" ON "meetings" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "idx_evidence_emails_meeting_id" ON "evidence_emails" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "idx_evidence_emails_meeting_id_status" ON "evidence_emails" USING btree ("meeting_id","status");--> statement-breakpoint
CREATE INDEX "idx_extraction_results_meeting_extracted" ON "extraction_results" USING btree ("meeting_id","extracted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_ingestion_artifacts_meeting_type" ON "ingestion_artifacts" USING btree ("meeting_id","artifact_type");--> statement-breakpoint
CREATE INDEX "idx_ingestion_artifacts_meeting_created" ON "ingestion_artifacts" USING btree ("meeting_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_insight_decision_logs_meeting_id" ON "insight_decision_logs" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "idx_insight_decision_logs_user_meeting_created" ON "insight_decision_logs" USING btree ("user_id","meeting_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_insights_meeting_id" ON "insights" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "idx_ocr_jobs_meeting_status" ON "ocr_jobs" USING btree ("meeting_id","status");--> statement-breakpoint
CREATE INDEX "idx_ocr_jobs_meeting_requested" ON "ocr_jobs" USING btree ("meeting_id","requested_at");--> statement-breakpoint
CREATE INDEX "idx_phases_meeting_id" ON "phases" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "idx_term_cluster_memberships_meeting_id" ON "term_cluster_memberships" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "idx_term_embeddings_meeting_id" ON "term_embeddings" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "idx_term_extraction_offsets_meeting_char" ON "term_extraction_offsets" USING btree ("meeting_id","char_start");--> statement-breakpoint
CREATE INDEX "idx_transcription_jobs_meeting_status" ON "transcription_jobs" USING btree ("meeting_id","status");--> statement-breakpoint
CREATE INDEX "idx_transcription_jobs_meeting_requested" ON "transcription_jobs" USING btree ("meeting_id","requested_at");--> statement-breakpoint
CREATE INDEX "idx_ingestion_artifacts_accepted" ON "ingestion_artifacts" USING btree ("meeting_id","accepted");--> statement-breakpoint
ALTER TABLE "consultation_group_members" ADD CONSTRAINT "consultation_group_members_round_meeting_key" UNIQUE("round_id","meeting_id");--> statement-breakpoint
ALTER TABLE "term_cluster_memberships" ADD CONSTRAINT "term_cluster_memberships_round_meeting_term_key" UNIQUE("round_id","meeting_id","term");--> statement-breakpoint
ALTER TABLE "term_embeddings" ADD CONSTRAINT "term_embeddings_meeting_term_entity_key" UNIQUE("meeting_id","term","entity_type");--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_status_check" CHECK ("meetings"."status" in ('draft', 'complete'));
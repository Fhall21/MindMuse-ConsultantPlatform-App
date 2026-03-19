CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"full_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultation_group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"consultation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consultation_group_members_round_consultation_key" UNIQUE("round_id","consultation_id"),
	CONSTRAINT "consultation_group_members_position_check" CHECK ("consultation_group_members"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "consultation_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consultation_groups_position_check" CHECK ("consultation_groups"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "consultation_people" (
	"consultation_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	CONSTRAINT "consultation_people_consultation_id_person_id_pk" PRIMARY KEY("consultation_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "consultation_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"transcript_raw" text,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"round_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consultations_status_check" CHECK ("consultations"."status" in ('draft', 'complete'))
);
--> statement-breakpoint
CREATE TABLE "evidence_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"subject" text,
	"body_draft" text,
	"body_final" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"generated_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_emails_status_check" CHECK ("evidence_emails"."status" in ('draft', 'accepted', 'sent'))
);
--> statement-breakpoint
CREATE TABLE "ingestion_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"artifact_type" text NOT NULL,
	"source_file_key" text NOT NULL,
	"metadata" jsonb,
	"accepted" boolean,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ocr_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"image_file_key" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"extracted_text" text,
	"confidence_score" numeric(3, 2),
	"error_message" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ocr_jobs_status_check" CHECK ("ocr_jobs"."status" in ('queued', 'processing', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"working_group" text,
	"work_type" text,
	"role" text,
	"email" text,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "round_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"decision_type" text NOT NULL,
	"rationale" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_decisions_target_type_check" CHECK ("round_decisions"."target_type" in ('source_theme', 'theme_group', 'round_output')),
	CONSTRAINT "round_decisions_decision_type_check" CHECK ("round_decisions"."decision_type" in ('accepted', 'discarded', 'management_rejected')),
	CONSTRAINT "round_decisions_management_rejected_requires_rationale" CHECK ("round_decisions"."decision_type" <> 'management_rejected' or ("round_decisions"."rationale" is not null and btrim("round_decisions"."rationale") <> ''))
);
--> statement-breakpoint
CREATE TABLE "round_output_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"artifact_type" text NOT NULL,
	"status" text DEFAULT 'generated' NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"input_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"group_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_output_artifacts_artifact_type_check" CHECK ("round_output_artifacts"."artifact_type" in ('summary', 'report', 'email')),
	CONSTRAINT "round_output_artifacts_status_check" CHECK ("round_output_artifacts"."status" in ('generated'))
);
--> statement-breakpoint
CREATE TABLE "round_theme_group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"theme_id" uuid NOT NULL,
	"source_consultation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_theme_group_members_round_theme_key" UNIQUE("round_id","theme_id"),
	CONSTRAINT "round_theme_group_members_position_check" CHECK ("round_theme_group_members"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "round_theme_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"origin" text DEFAULT 'manual' NOT NULL,
	"ai_draft_label" text,
	"ai_draft_description" text,
	"ai_draft_explanation" text,
	"ai_draft_created_at" timestamp with time zone,
	"ai_draft_created_by" uuid,
	"last_structural_change_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_structural_change_by" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_theme_groups_status_check" CHECK ("round_theme_groups"."status" in ('draft', 'accepted', 'discarded', 'management_rejected')),
	CONSTRAINT "round_theme_groups_origin_check" CHECK ("round_theme_groups"."origin" in ('manual', 'ai_refined'))
);
--> statement-breakpoint
CREATE TABLE "theme_decision_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"consultation_id" uuid NOT NULL,
	"theme_id" uuid,
	"round_id" uuid,
	"decision_type" text NOT NULL,
	"rationale" text,
	"theme_label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "theme_decision_logs_decision_type_check" CHECK ("theme_decision_logs"."decision_type" in ('accept', 'reject', 'user_added'))
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"accepted" boolean DEFAULT false NOT NULL,
	"is_user_added" boolean DEFAULT false NOT NULL,
	"weight" numeric(10, 2) DEFAULT '1.0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcription_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"audio_file_key" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"transcript_text" text,
	"error_message" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transcription_jobs_status_check" CHECK ("transcription_jobs"."status" in ('queued', 'processing', 'completed', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_group_members" ADD CONSTRAINT "consultation_group_members_group_id_consultation_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."consultation_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_group_members" ADD CONSTRAINT "consultation_group_members_round_id_consultation_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."consultation_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_group_members" ADD CONSTRAINT "consultation_group_members_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_group_members" ADD CONSTRAINT "consultation_group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_group_members" ADD CONSTRAINT "consultation_group_members_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_groups" ADD CONSTRAINT "consultation_groups_round_id_consultation_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."consultation_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_groups" ADD CONSTRAINT "consultation_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_groups" ADD CONSTRAINT "consultation_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_people" ADD CONSTRAINT "consultation_people_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_people" ADD CONSTRAINT "consultation_people_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_rounds" ADD CONSTRAINT "consultation_rounds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_round_id_consultation_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."consultation_rounds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_emails" ADD CONSTRAINT "evidence_emails_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_artifacts" ADD CONSTRAINT "ingestion_artifacts_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocr_jobs" ADD CONSTRAINT "ocr_jobs_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_decisions" ADD CONSTRAINT "round_decisions_round_id_consultation_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."consultation_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_decisions" ADD CONSTRAINT "round_decisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_output_artifacts" ADD CONSTRAINT "round_output_artifacts_round_id_consultation_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."consultation_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_output_artifacts" ADD CONSTRAINT "round_output_artifacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_output_artifacts" ADD CONSTRAINT "round_output_artifacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_theme_group_members" ADD CONSTRAINT "round_theme_group_members_group_id_round_theme_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."round_theme_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_theme_group_members" ADD CONSTRAINT "round_theme_group_members_round_id_consultation_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."consultation_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_theme_group_members" ADD CONSTRAINT "round_theme_group_members_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_theme_group_members" ADD CONSTRAINT "round_theme_group_members_source_consultation_id_consultations_id_fk" FOREIGN KEY ("source_consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_theme_group_members" ADD CONSTRAINT "round_theme_group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_theme_group_members" ADD CONSTRAINT "round_theme_group_members_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_theme_groups" ADD CONSTRAINT "round_theme_groups_round_id_consultation_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."consultation_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_theme_groups" ADD CONSTRAINT "round_theme_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_theme_groups" ADD CONSTRAINT "round_theme_groups_ai_draft_created_by_users_id_fk" FOREIGN KEY ("ai_draft_created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_theme_groups" ADD CONSTRAINT "round_theme_groups_last_structural_change_by_users_id_fk" FOREIGN KEY ("last_structural_change_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_theme_groups" ADD CONSTRAINT "round_theme_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_decision_logs" ADD CONSTRAINT "theme_decision_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_decision_logs" ADD CONSTRAINT "theme_decision_logs_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_decision_logs" ADD CONSTRAINT "theme_decision_logs_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_decision_logs" ADD CONSTRAINT "theme_decision_logs_round_id_consultation_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."consultation_rounds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcription_jobs" ADD CONSTRAINT "transcription_jobs_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_key" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "profiles_display_name_idx" ON "profiles" USING btree ("display_name");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "idx_audit_log_consultation_id" ON "audit_log" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_user_id" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_created_at" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_entity_type" ON "audit_log" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "idx_audit_log_entity_id" ON "audit_log" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_action" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_consultation_group_members_group_id" ON "consultation_group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_consultation_group_members_round_id" ON "consultation_group_members" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "idx_consultation_group_members_consultation_id" ON "consultation_group_members" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "idx_consultation_groups_round_id" ON "consultation_groups" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "idx_consultation_groups_user_round" ON "consultation_groups" USING btree ("user_id","round_id");--> statement-breakpoint
CREATE INDEX "idx_consultation_rounds_user_id" ON "consultation_rounds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_consultations_user_id" ON "consultations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_consultations_status" ON "consultations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_consultations_round_id" ON "consultations" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "idx_evidence_emails_consultation_id" ON "evidence_emails" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "idx_evidence_emails_status" ON "evidence_emails" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_evidence_emails_consultation_id_status" ON "evidence_emails" USING btree ("consultation_id","status");--> statement-breakpoint
CREATE INDEX "idx_ingestion_artifacts_consultation_type" ON "ingestion_artifacts" USING btree ("consultation_id","artifact_type");--> statement-breakpoint
CREATE INDEX "idx_ingestion_artifacts_consultation_created" ON "ingestion_artifacts" USING btree ("consultation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_ingestion_artifacts_accepted" ON "ingestion_artifacts" USING btree ("consultation_id","accepted");--> statement-breakpoint
CREATE INDEX "idx_ocr_jobs_consultation_status" ON "ocr_jobs" USING btree ("consultation_id","status");--> statement-breakpoint
CREATE INDEX "idx_ocr_jobs_consultation_requested" ON "ocr_jobs" USING btree ("consultation_id","requested_at");--> statement-breakpoint
CREATE INDEX "idx_ocr_jobs_status" ON "ocr_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_people_user_id" ON "people" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_round_decisions_round_target" ON "round_decisions" USING btree ("round_id","target_type","target_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_round_output_artifacts_round_type" ON "round_output_artifacts" USING btree ("round_id","artifact_type","generated_at");--> statement-breakpoint
CREATE INDEX "idx_round_theme_group_members_round_id" ON "round_theme_group_members" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "idx_round_theme_group_members_theme_id" ON "round_theme_group_members" USING btree ("theme_id");--> statement-breakpoint
CREATE INDEX "idx_round_theme_groups_round_id" ON "round_theme_groups" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "idx_round_theme_groups_user_round_status" ON "round_theme_groups" USING btree ("user_id","round_id","status");--> statement-breakpoint
CREATE INDEX "idx_theme_decision_logs_user_id" ON "theme_decision_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_theme_decision_logs_consultation_id" ON "theme_decision_logs" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "idx_theme_decision_logs_theme_id" ON "theme_decision_logs" USING btree ("theme_id");--> statement-breakpoint
CREATE INDEX "idx_theme_decision_logs_round_id" ON "theme_decision_logs" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "idx_theme_decision_logs_user_consultation_created" ON "theme_decision_logs" USING btree ("user_id","consultation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_theme_decision_logs_theme_label" ON "theme_decision_logs" USING btree ("theme_label");--> statement-breakpoint
CREATE INDEX "idx_themes_consultation_id" ON "themes" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "idx_themes_user_added" ON "themes" USING btree ("is_user_added");--> statement-breakpoint
CREATE INDEX "idx_transcription_jobs_consultation_status" ON "transcription_jobs" USING btree ("consultation_id","status");--> statement-breakpoint
CREATE INDEX "idx_transcription_jobs_consultation_requested" ON "transcription_jobs" USING btree ("consultation_id","requested_at");--> statement-breakpoint
CREATE INDEX "idx_transcription_jobs_status" ON "transcription_jobs" USING btree ("status");

CREATE TABLE "cross_analysis_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"consultation_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"results" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cross_analysis_jobs_status_check" CHECK ("cross_analysis_jobs"."status" in ('queued', 'running', 'complete', 'error'))
);
--> statement-breakpoint
ALTER TABLE "cross_analysis_jobs" ADD CONSTRAINT "cross_analysis_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_analysis_jobs" ADD CONSTRAINT "cross_analysis_jobs_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cross_analysis_jobs_consultation_id_idx" ON "cross_analysis_jobs" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "cross_analysis_jobs_user_consultation_idx" ON "cross_analysis_jobs" USING btree ("user_id","consultation_id");
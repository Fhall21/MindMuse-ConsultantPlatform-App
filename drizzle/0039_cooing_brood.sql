CREATE TABLE "canvas_spatial_layout_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result_positions" jsonb,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "canvas_spatial_layout_jobs_status_check" CHECK ("canvas_spatial_layout_jobs"."status" in ('pending','running','completed','failed','cancelled'))
);
--> statement-breakpoint
ALTER TABLE "canvas_spatial_layout_jobs" ADD CONSTRAINT "canvas_spatial_layout_jobs_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_spatial_layout_jobs" ADD CONSTRAINT "canvas_spatial_layout_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_csljobs_consultation_user" ON "canvas_spatial_layout_jobs" USING btree ("consultation_id","user_id");
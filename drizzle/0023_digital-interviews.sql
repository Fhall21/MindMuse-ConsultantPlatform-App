CREATE TABLE "digital_interview_flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"consultation_id" uuid,
	"title" text NOT NULL,
	"framework" text NOT NULL,
	"custom_framework_prompt" text,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"depth_level" text DEFAULT 'moderate' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"share_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "digital_interview_flows_share_token_unique" UNIQUE("share_token"),
	CONSTRAINT "digital_interview_flows_status_check" CHECK ("digital_interview_flows"."status" in ('draft', 'active', 'closed')),
	CONSTRAINT "digital_interview_flows_depth_check" CHECK ("digital_interview_flows"."depth_level" in ('surface', 'moderate', 'deep')),
	CONSTRAINT "digital_interview_flows_framework_check" CHECK ("digital_interview_flows"."framework" in ('appreciative_inquiry', 'psychological_safety', 'custom'))
);
--> statement-breakpoint
CREATE TABLE "digital_interview_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flow_id" uuid NOT NULL,
	"session_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"interviewee_name" text,
	"interviewee_email" text,
	"interviewee_role" text,
	"interviewee_work_group" text,
	"interviewee_organisation" text,
	"person_id" uuid,
	"person_match_confidence" text,
	"conversation_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "digital_interview_responses_session_token_unique" UNIQUE("session_token"),
	CONSTRAINT "digital_interview_responses_status_check" CHECK ("digital_interview_responses"."status" in ('in_progress', 'completed', 'abandoned'))
);
--> statement-breakpoint
CREATE TABLE "feature_interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"feature_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_interests_user_feature_key" UNIQUE("user_id","feature_key")
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "organisation_id" uuid;--> statement-breakpoint
ALTER TABLE "digital_interview_flows" ADD CONSTRAINT "digital_interview_flows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_interview_flows" ADD CONSTRAINT "digital_interview_flows_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_interview_responses" ADD CONSTRAINT "digital_interview_responses_flow_id_digital_interview_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."digital_interview_flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_interview_responses" ADD CONSTRAINT "digital_interview_responses_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_interests" ADD CONSTRAINT "feature_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_digital_interview_flows_user_id" ON "digital_interview_flows" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_digital_interview_flows_consultation_id" ON "digital_interview_flows" USING btree ("consultation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_digital_interview_flows_share_token" ON "digital_interview_flows" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "idx_digital_interview_responses_flow_id" ON "digital_interview_responses" USING btree ("flow_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_digital_interview_responses_session_token" ON "digital_interview_responses" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "idx_digital_interview_responses_status" ON "digital_interview_responses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_digital_interview_responses_person_id" ON "digital_interview_responses" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_organisations_user_id" ON "organisations" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE set null ON UPDATE no action;
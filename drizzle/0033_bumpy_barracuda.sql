CREATE TABLE "research_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_type" text NOT NULL,
	"query" text NOT NULL,
	"industry_ctx" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"task_id" text,
	"result_data" jsonb,
	"file_entry_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "research_sessions_session_type_check" CHECK ("research_sessions"."session_type" in ('literature', 'analysis')),
	CONSTRAINT "research_sessions_status_check" CHECK ("research_sessions"."status" in ('pending', 'running', 'complete', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "user_ai_preferences" ADD COLUMN "industry" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "research_sessions" ADD CONSTRAINT "research_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_research_sessions_user_id" ON "research_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_research_sessions_user_created" ON "research_sessions" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_research_sessions_user_type" ON "research_sessions" USING btree ("user_id","session_type");--> statement-breakpoint
CREATE INDEX "idx_research_sessions_task_id" ON "research_sessions" USING btree ("task_id");
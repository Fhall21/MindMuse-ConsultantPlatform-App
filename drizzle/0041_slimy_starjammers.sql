CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"tool_call_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_messages_role_check" CHECK ("chat_messages"."role" in ('user', 'assistant', 'tool', 'system'))
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"consultation_id" uuid,
	"user_mode" text DEFAULT 'onboarding' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_sessions_user_mode_check" CHECK ("chat_sessions"."user_mode" in ('onboarding', 'returning'))
);
--> statement-breakpoint
CREATE TABLE "chat_tool_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_tool_results_status_check" CHECK ("chat_tool_results"."status" in ('pending', 'success', 'error', 'dismissed'))
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_tool_results" ADD CONSTRAINT "chat_tool_results_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_tool_results" ADD CONSTRAINT "chat_tool_results_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_session_id_idx" ON "chat_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chat_sessions_user_id_idx" ON "chat_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_sessions_consultation_id_idx" ON "chat_sessions" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "chat_tool_results_session_id_idx" ON "chat_tool_results" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chat_tool_results_message_id_idx" ON "chat_tool_results" USING btree ("message_id");
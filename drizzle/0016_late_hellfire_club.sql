CREATE TABLE "ai_insight_learnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"topic_type" text DEFAULT 'theme_generation' NOT NULL,
	"learning_type" text NOT NULL,
	"label" text NOT NULL,
	"description" text NOT NULL,
	"supporting_metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"version" smallint DEFAULT 1 NOT NULL,
	CONSTRAINT "ai_insight_learnings_topic_type_check" CHECK ("ai_insight_learnings"."topic_type" in ('theme_generation')),
	CONSTRAINT "ai_insight_learnings_learning_type_check" CHECK ("ai_insight_learnings"."learning_type" in ('process_pattern', 'trend', 'rejection_signal', 'preference_alignment')),
	CONSTRAINT "ai_insight_learnings_version_check" CHECK ("ai_insight_learnings"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "ai_insight_learnings" ADD CONSTRAINT "ai_insight_learnings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_insight_learnings_user_topic_created" ON "ai_insight_learnings" USING btree ("user_id","topic_type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_ai_insight_learnings_user_type" ON "ai_insight_learnings" USING btree ("user_id","learning_type");
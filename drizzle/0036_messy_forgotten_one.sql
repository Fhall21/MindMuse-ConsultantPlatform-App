CREATE TABLE "canvas_research_insights" (
	"consultation_id" uuid NOT NULL,
	"insight_id" uuid NOT NULL,
	"position_x" double precision,
	"position_y" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "canvas_research_insights_consultation_id_insight_id_pk" PRIMARY KEY("consultation_id","insight_id")
);
--> statement-breakpoint
CREATE TABLE "insight_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insight_id" uuid NOT NULL,
	"research_session_id" uuid NOT NULL,
	"quote" text NOT NULL,
	"locator" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "canvas_connections" DROP CONSTRAINT "canvas_connections_connection_type_check";--> statement-breakpoint
ALTER TABLE "insights" DROP CONSTRAINT "insights_source_check";--> statement-breakpoint
ALTER TABLE "insights" ADD COLUMN "research_session_id" uuid;--> statement-breakpoint
ALTER TABLE "canvas_research_insights" ADD CONSTRAINT "canvas_research_insights_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_research_insights" ADD CONSTRAINT "canvas_research_insights_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_quotes" ADD CONSTRAINT "insight_quotes_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_quotes" ADD CONSTRAINT "insight_quotes_research_session_id_research_sessions_id_fk" FOREIGN KEY ("research_session_id") REFERENCES "public"."research_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_canvas_research_insights_consultation" ON "canvas_research_insights" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "idx_canvas_research_insights_insight" ON "canvas_research_insights" USING btree ("insight_id");--> statement-breakpoint
CREATE INDEX "idx_insight_quotes_insight_id" ON "insight_quotes" USING btree ("insight_id");--> statement-breakpoint
CREATE INDEX "idx_insight_quotes_session_id" ON "insight_quotes" USING btree ("research_session_id");--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_research_session_id_research_sessions_id_fk" FOREIGN KEY ("research_session_id") REFERENCES "public"."research_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_insights_research_session_id" ON "insights" USING btree ("research_session_id");--> statement-breakpoint
ALTER TABLE "canvas_connections" ADD CONSTRAINT "canvas_connections_connection_type_check" CHECK ("canvas_connections"."connection_type" in ('causes', 'influences', 'supports', 'contradicts', 'context', 'related_to'));--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_source_check" CHECK ((meeting_id IS NOT NULL) OR (flow_id IS NOT NULL) OR (research_session_id IS NOT NULL));
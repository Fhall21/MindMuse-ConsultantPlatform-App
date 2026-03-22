CREATE TABLE "round_cross_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"source_consultation_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "round_cross_insights" ADD CONSTRAINT "round_cross_insights_round_id_consultation_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."consultation_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_cross_insights" ADD CONSTRAINT "round_cross_insights_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_round_cross_insights_round_id" ON "round_cross_insights" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "idx_round_cross_insights_created_by" ON "round_cross_insights" USING btree ("created_by");
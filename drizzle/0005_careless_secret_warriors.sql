CREATE TABLE "phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"type" text NOT NULL,
	"label" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "phases_type_check" CHECK ("phases"."type" in ('discovery', 'discussion', 'review_feedback')),
	CONSTRAINT "phases_position_check" CHECK ("phases"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "phases" ADD CONSTRAINT "phases_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_phases_consultation_id" ON "phases" USING btree ("consultation_id");--> statement-breakpoint
CREATE INDEX "idx_phases_type" ON "phases" USING btree ("type");
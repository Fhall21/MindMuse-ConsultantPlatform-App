CREATE TABLE "quote_insight_links" (
	"quote_id" uuid NOT NULL,
	"insight_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"link_type" text DEFAULT 'durable' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_insight_links_quote_id_insight_id_pk" PRIMARY KEY("quote_id","insight_id"),
	CONSTRAINT "quote_insight_links_link_type_check" CHECK ("quote_insight_links"."link_type" in ('durable', 'provisional'))
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"span_start" integer NOT NULL,
	"span_end" integer NOT NULL,
	"exact_text" text NOT NULL,
	"speaker_label" text,
	"work_group_label" text,
	"person_id" uuid,
	"status" text DEFAULT 'suggested' NOT NULL,
	"source" text DEFAULT 'ai' NOT NULL,
	"anonymous_mask_rule" text DEFAULT 'role_workgroup' NOT NULL,
	"risk_flag" boolean DEFAULT false NOT NULL,
	"risk_reason" text,
	"rejection_reason" text,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_status_check" CHECK ("quotes"."status" in ('suggested', 'approved', 'rejected')),
	CONSTRAINT "quotes_source_check" CHECK ("quotes"."source" in ('ai', 'manual')),
	CONSTRAINT "quotes_mask_rule_check" CHECK ("quotes"."anonymous_mask_rule" in ('role_workgroup', 'redact', 'none')),
	CONSTRAINT "quotes_span_check" CHECK ("quotes"."span_end" > "quotes"."span_start")
);
--> statement-breakpoint
ALTER TABLE "quote_insight_links" ADD CONSTRAINT "quote_insight_links_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_insight_links" ADD CONSTRAINT "quote_insight_links_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_quote_insight_links_insight_id" ON "quote_insight_links" USING btree ("insight_id");--> statement-breakpoint
CREATE INDEX "idx_quote_insight_links_primary" ON "quote_insight_links" USING btree ("quote_id","is_primary");--> statement-breakpoint
CREATE INDEX "idx_quotes_meeting_id" ON "quotes" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_user_id" ON "quotes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_status" ON "quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_quotes_meeting_status" ON "quotes" USING btree ("meeting_id","status");
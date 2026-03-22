CREATE TABLE "meeting_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"code" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_types_user_code_key" UNIQUE("user_id","code"),
	CONSTRAINT "meeting_types_user_label_key" UNIQUE("user_id","label")
);
--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "meeting_type_id" uuid;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "meeting_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meeting_types" ADD CONSTRAINT "meeting_types_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_meeting_types_user_id" ON "meeting_types" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_meeting_types_active" ON "meeting_types" USING btree ("user_id","is_active");--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_meeting_type_id_meeting_types_id_fk" FOREIGN KEY ("meeting_type_id") REFERENCES "public"."meeting_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_meetings_meeting_type_id" ON "meetings" USING btree ("meeting_type_id");--> statement-breakpoint
CREATE INDEX "idx_meetings_meeting_date" ON "meetings" USING btree ("meeting_date");
CREATE TABLE "report_share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"artifact_id" uuid NOT NULL,
	"token" text NOT NULL,
	"consultant_name" text,
	"consultant_email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_report_share_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"passcode_hash" text NOT NULL,
	"passcode_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_report_share_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "report_share_links" ADD CONSTRAINT "report_share_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_share_links" ADD CONSTRAINT "report_share_links_artifact_id_consultation_output_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."consultation_output_artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_share_links" ADD CONSTRAINT "report_share_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_report_share_settings" ADD CONSTRAINT "user_report_share_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_report_share_settings" ADD CONSTRAINT "user_report_share_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "report_share_links_token_key" ON "report_share_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_report_share_links_artifact_id" ON "report_share_links" USING btree ("artifact_id");--> statement-breakpoint
CREATE INDEX "idx_report_share_links_user_id" ON "report_share_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_report_share_links_expires_at" ON "report_share_links" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_user_report_share_settings_user_id" ON "user_report_share_settings" USING btree ("user_id");
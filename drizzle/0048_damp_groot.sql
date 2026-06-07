CREATE TABLE "grid_cell_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insight_id" uuid NOT NULL,
	"grid_cell_id" uuid NOT NULL,
	"grid_column_id" uuid NOT NULL,
	"grid_review_state" text DEFAULT 'pending',
	"accepted" boolean DEFAULT false NOT NULL,
	"rejected" boolean DEFAULT false NOT NULL,
	"edited_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grid_cells" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"column_id" uuid NOT NULL,
	"status" text DEFAULT 'pending',
	"confidence" text,
	"quote_count" integer DEFAULT 0,
	"insight_count" integer DEFAULT 0,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grid_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"question" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quote_insight_links" ADD COLUMN "relevance_strength" text;--> statement-breakpoint
ALTER TABLE "grid_cell_insights" ADD CONSTRAINT "grid_cell_insights_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_cell_insights" ADD CONSTRAINT "grid_cell_insights_grid_cell_id_grid_cells_id_fk" FOREIGN KEY ("grid_cell_id") REFERENCES "public"."grid_cells"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_cell_insights" ADD CONSTRAINT "grid_cell_insights_grid_column_id_grid_columns_id_fk" FOREIGN KEY ("grid_column_id") REFERENCES "public"."grid_columns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_cells" ADD CONSTRAINT "grid_cells_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_cells" ADD CONSTRAINT "grid_cells_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_cells" ADD CONSTRAINT "grid_cells_column_id_grid_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."grid_columns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_columns" ADD CONSTRAINT "grid_columns_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_columns" ADD CONSTRAINT "grid_columns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "grid_cell_insights_insight_cell_idx" ON "grid_cell_insights" USING btree ("insight_id","grid_cell_id");--> statement-breakpoint
CREATE UNIQUE INDEX "grid_cells_meeting_column_idx" ON "grid_cells" USING btree ("meeting_id","column_id");
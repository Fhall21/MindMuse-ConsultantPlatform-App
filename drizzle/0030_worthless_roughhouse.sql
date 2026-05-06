CREATE TABLE "canvas_frames" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"node_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"viewport" jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "canvas_frames" ADD CONSTRAINT "canvas_frames_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_frames" ADD CONSTRAINT "canvas_frames_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_canvas_frames_consultation_user" ON "canvas_frames" USING btree ("consultation_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_canvas_frames_position" ON "canvas_frames" USING btree ("consultation_id","user_id","position");
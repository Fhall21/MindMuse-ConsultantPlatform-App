-- Custom SQL migration file, put your code below! -
-- These tables were added to the schema and snapshots early (snapshot 0003)
-- but were never emitted as SQL. This migration creates them safely on any DB.

CREATE TABLE IF NOT EXISTS "report_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "style_notes" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "prescriptiveness" text DEFAULT 'moderate' NOT NULL,
  "source_file_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "report_templates_prescriptiveness_check" CHECK (
    prescriptiveness IN ('flexible', 'moderate', 'strict')
  )
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'report_templates_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "report_templates"
      ADD CONSTRAINT "report_templates_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'report_templates_created_by_users_id_fk'
  ) THEN
    ALTER TABLE "report_templates"
      ADD CONSTRAINT "report_templates_created_by_users_id_fk"
      FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_report_templates_user_id" ON "report_templates" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_report_templates_active" ON "report_templates" ("user_id", "is_active");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_ai_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "consultation_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "focus_areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "excluded_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "user_ai_preferences_user_id_unique" UNIQUE ("user_id")
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_ai_preferences_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "user_ai_preferences"
      ADD CONSTRAINT "user_ai_preferences_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_ai_preferences_user_id" ON "user_ai_preferences" ("user_id");

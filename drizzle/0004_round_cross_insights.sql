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

ALTER TABLE "round_cross_insights"
  ADD CONSTRAINT "round_cross_insights_round_id_consultation_rounds_id_fk"
  FOREIGN KEY ("round_id") REFERENCES "consultation_rounds"("id") ON DELETE CASCADE;

ALTER TABLE "round_cross_insights"
  ADD CONSTRAINT "round_cross_insights_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE;

CREATE INDEX "idx_round_cross_insights_round_id" ON "round_cross_insights" ("round_id");
CREATE INDEX "idx_round_cross_insights_created_by" ON "round_cross_insights" ("created_by");

-- Add soft-delete columns to insights table so rejected insights persist across page refreshes
ALTER TABLE "insights" ADD COLUMN "rejected" boolean NOT NULL DEFAULT false;
ALTER TABLE "insights" ADD COLUMN "rejected_at" timestamp with time zone;

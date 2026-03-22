ALTER TABLE "ocr_jobs" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "ocr_jobs" ADD COLUMN "image_sequence" integer;--> statement-breakpoint
CREATE INDEX "idx_ocr_jobs_batch_sequence" ON "ocr_jobs" USING btree ("batch_id","image_sequence");
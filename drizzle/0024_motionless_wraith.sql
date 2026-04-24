ALTER TABLE "insights" ALTER COLUMN "meeting_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "insights" ADD COLUMN "flow_id" uuid;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_flow_id_digital_interview_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."digital_interview_flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_insights_flow_id" ON "insights" USING btree ("flow_id");--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_source_check" CHECK ((meeting_id IS NOT NULL) OR (flow_id IS NOT NULL));
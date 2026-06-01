ALTER TABLE "chat_tool_results" ALTER COLUMN "message_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_tool_results" ADD COLUMN "seen_at" timestamp with time zone;
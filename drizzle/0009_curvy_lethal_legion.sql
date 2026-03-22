ALTER TABLE "term_clusters" RENAME COLUMN "consultation_count" TO "meeting_count";--> statement-breakpoint
ALTER TABLE "term_clusters" DROP CONSTRAINT "term_clusters_consultation_count_check";--> statement-breakpoint
ALTER TABLE "term_clusters" ADD CONSTRAINT "term_clusters_meeting_count_check" CHECK ("term_clusters"."meeting_count" >= 0);
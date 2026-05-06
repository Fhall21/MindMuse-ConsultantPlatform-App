ALTER TABLE "canvas_frames" ADD COLUMN "x" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "canvas_frames" ADD COLUMN "y" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "canvas_frames" ADD COLUMN "width" double precision DEFAULT 600 NOT NULL;--> statement-breakpoint
ALTER TABLE "canvas_frames" ADD COLUMN "height" double precision DEFAULT 400 NOT NULL;--> statement-breakpoint
ALTER TABLE "canvas_frames" ADD COLUMN "color" text DEFAULT 'blue' NOT NULL;
CREATE TABLE "canvas_node_embeddings" (
	"id" text PRIMARY KEY NOT NULL,
	"text_hash" text NOT NULL,
	"embedding" real[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "canvas_node_embeddings_text_hash_unique" UNIQUE("text_hash")
);

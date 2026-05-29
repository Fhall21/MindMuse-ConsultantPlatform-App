import { pgTable, real, text, timestamp, unique } from "drizzle-orm/pg-core";

export const canvasNodeEmbeddings = pgTable(
  "canvas_node_embeddings",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    textHash: text("text_hash").notNull(),
    embedding: real("embedding").array().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    textHashUnique: unique("canvas_node_embeddings_text_hash_unique").on(table.textHash),
  })
);
